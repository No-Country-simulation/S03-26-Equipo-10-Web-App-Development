import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const repository =
  'No-Country-simulation/S03-26-Equipo-10-Web-App-Development';
export const versionPattern =
  /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:[a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)*))?$/;
export const shaPattern = /^[a-f0-9]{40}$/;
export const fail = (code) => {
  throw new Error(code);
};

export async function github(path, env = process.env) {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/${path}`,
    {
      headers: {
        Authorization: `Bearer ${env.GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    },
  );
  if (!response.ok) fail('RELEASE_GITHUB_READ_FAILED');
  return response.json();
}

export async function qualify(env, get = (path) => github(path, env)) {
  if (env.GITHUB_REPOSITORY !== repository) fail('RELEASE_REPOSITORY_INVALID');
  if (env.DEMO_DELIVERY_ENABLED !== 'true') fail('RELEASE_NOT_ARMED');
  const manual = env.GITHUB_EVENT_NAME === 'workflow_dispatch';
  if (!manual && env.GITHUB_EVENT_NAME !== 'push')
    fail('RELEASE_EVENT_INVALID');
  if (manual && env.GITHUB_REF !== 'refs/heads/main')
    fail('RELEASE_CONTROLLER_MUST_BE_MAIN');
  const tag = manual
    ? env.RELEASE_TAG
    : env.GITHUB_REF?.replace(/^refs\/tags\//, '');
  if (
    !tag ||
    !versionPattern.test(tag) ||
    (!manual && env.GITHUB_REF !== `refs/tags/${tag}`)
  )
    fail('RELEASE_TAG_INVALID');
  const ref = await get(`git/ref/tags/${encodeURIComponent(tag)}`);
  if (ref.object?.type !== 'tag') fail('RELEASE_ANNOTATED_TAG_REQUIRED');
  const annotation = await get(`git/tags/${ref.object.sha}`);
  if (
    annotation.object?.type !== 'commit' ||
    !shaPattern.test(annotation.object.sha)
  )
    fail('RELEASE_TAG_TARGET_INVALID');
  const sha = annotation.object.sha;
  if (manual && env.RELEASE_BUILD === 'true' && env.GITHUB_SHA !== sha)
    fail('RELEASE_BUILD_SOURCE_MISMATCH');
  const main = await get('branches/main');
  if (!main.protected) fail('RELEASE_MAIN_UNPROTECTED');
  const comparison = await get(`compare/${sha}...${main.commit.sha}`);
  if (!['identical', 'ahead'].includes(comparison.status))
    fail('RELEASE_COMMIT_NOT_ON_MAIN');
  const runs = await get(
    `actions/workflows/ci.yml/runs?event=push&branch=main&head_sha=${sha}&per_page=100`,
  );
  const run = runs.workflow_runs
    .filter(
      (item) =>
        item.head_sha === sha &&
        item.event === 'push' &&
        item.head_branch === 'main',
    )
    .sort((a, b) => b.run_number - a.run_number)[0];
  if (!run || run.status !== 'completed' || run.conclusion !== 'success')
    fail('RELEASE_MAIN_CI_NOT_GREEN');
  const jobs = [];
  for (let page = 1; ; page++) {
    const result = await get(
      `actions/runs/${run.id}/jobs?filter=latest&per_page=100&page=${page}`,
    );
    jobs.push(...result.jobs);
    if (jobs.length >= result.total_count) break;
    if (page >= 10 || !result.jobs.length) fail('RELEASE_CI_JOBS_INCOMPLETE');
  }
  for (const name of ['verify', 'secret-scan']) {
    if (
      jobs.filter((job) => job.name === name && job.conclusion === 'success')
        .length !== 1
    )
      fail('RELEASE_CI_GATE_MISSING');
  }
  const environment = env.RELEASE_ENVIRONMENT ?? 'demo';
  if (!['demo', 'demo-migrations'].includes(environment))
    fail('RELEASE_ENVIRONMENT_INVALID');
  const settings = await get(`environments/${environment}`);
  if (
    !settings.protection_rules?.some(
      (rule) => rule.type === 'required_reviewers' && rule.reviewers?.length,
    )
  )
    fail('RELEASE_APPROVAL_REQUIRED');
  if (!settings.deployment_branch_policy?.custom_branch_policies)
    fail('RELEASE_ENVIRONMENT_REFS_UNRESTRICTED');
  const policies = await get(
    `environments/${environment}/deployment-branch-policies`,
  );
  const allowed = policies.branch_policies?.some((policy) =>
    manual
      ? policy.type === 'branch' && policy.name === 'main'
      : policy.type === 'tag' && policy.name === 'v*',
  );
  if (!allowed) fail('RELEASE_ENVIRONMENT_REF_NOT_ALLOWED');
  return {
    sha,
    tag,
    ciRunId: run.id,
    ciRunAttempt: run.run_attempt,
    environment,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const release = await qualify(process.env);
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `sha=${release.sha}\ntag=${release.tag}\nci_run_id=${release.ciRunId}\nci_run_attempt=${release.ciRunAttempt}\n`,
      );
    console.log(JSON.stringify({ event: 'release.qualified', ...release }));
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'release.rejected',
        code: /^RELEASE_[A-Z_]+$/.test(error.message)
          ? error.message
          : 'RELEASE_VALIDATION_FAILED',
      }),
    );
    process.exitCode = 1;
  }
}
