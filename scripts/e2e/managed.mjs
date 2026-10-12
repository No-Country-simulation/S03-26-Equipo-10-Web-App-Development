import assert from 'node:assert/strict';

export const ownerLabel = 'testimonial.e2e.run';
export function resourceName(runId, kind) {
  assert.match(runId, /^[a-f0-9]{12}$/);
  assert.ok(['pg', 'redis', 'api', 'network', 'image'].includes(kind));
  return `tms-e2e-${runId}-${kind}`;
}
export function assertOwner(resource, runId, kind) {
  assert.equal(resource.Name?.replace(/^\//, ''), resourceName(runId, kind));
  assert.equal(
    resource.Config?.Labels?.[ownerLabel] ?? resource.Labels?.[ownerLabel],
    runId,
  );
}
export function validateContainer(c, { runId, kind, port, dataPath }) {
  assertOwner(c, runId, kind);
  assert.equal(c.State?.Running, true);
  assert.ok(
    c.Mounts.every((m) => m.Type === 'tmpfs'),
    'Persistent mounts forbidden',
  );
  if (dataPath) assert.ok(Object.hasOwn(c.HostConfig.Tmpfs ?? {}, dataPath));
  const bindings = c.NetworkSettings.Ports[port];
  assert.equal(bindings?.length, 1);
  assert.equal(bindings[0].HostIp, '127.0.0.1');
  const hostPort = Number(bindings[0].HostPort);
  assert.ok(Number.isInteger(hostPort) && hostPort > 0 && hostPort <= 65535);
  return hostPort;
}
export function assertMigrationConsent(value) {
  assert.equal(
    value,
    '1',
    'E2E_ALLOW_DISPOSABLE_MIGRATIONS=1 requiere ACK humano específico',
  );
}
export function validateOrigin(value) {
  const url = new URL(value);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.ok(
    url.port &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash,
  );
  return url.origin;
}
