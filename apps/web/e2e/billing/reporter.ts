import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type {
  Reporter,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from '@playwright/test/reporter';
import { summarize } from '../../../../scripts/billing/evidence.mjs';
export default class BillingReporter implements Reporter {
  private failures: string[] = [];
  private total = 0;
  private errors = 0;
  private records: Array<{
    id: string;
    project: string;
    status: string;
    retry: number;
    duration: number;
  }> = [];
  onBegin(_config: unknown, suite: Suite) {
    this.total = suite.allTests().length;
  }
  onError() {
    this.errors++;
  }
  onTestEnd(test: TestCase, result: TestResult) {
    for (const error of result.errors) {
      const safe = error.message?.match(
        /^E2E failed at (fixtures\.ts|billing-desktop\.spec\.ts|billing-mobile\.spec\.ts):[0-9]+; sensitive diagnostics withheld$/,
      );
      if (safe) {
        this.failures.push(safe[0]);
        process.stdout.write(safe[0] + '\n');
      }
    }
    this.records.push({
      id: test.title.split(' ')[0]!,
      project: test.parent.project()?.name ?? '',
      status: result.status,
      retry: result.retry,
      duration: result.duration,
    });
  }
  async onEnd(result: FullResult): Promise<{ status: 'passed' | 'failed' }> {
    const report = summarize(this.records, {
      status: result.status,
      total: this.total,
      errors: this.errors,
    });
    const dir = path.resolve('.e2e-results/billing');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, 'failures.json'),
      JSON.stringify(this.failures),
    );
    writeFileSync(
      path.join(dir, 'results.json'),
      JSON.stringify(report, null, 2),
    );
    process.stdout.write(
      `BILLING E2E ${report.passed}/${report.expected}; complete=${report.complete}\n`,
    );
    return { status: report.complete ? 'passed' : 'failed' };
  }
}
