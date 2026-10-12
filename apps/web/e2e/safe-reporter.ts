import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type {
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { summarize } from '../../../scripts/e2e/evidence.mjs';

export default class SafeReporter implements Reporter {
  private directory: string;
  constructor(options: { outputDir?: string } = {}) {
    this.directory = path.resolve(options.outputDir ?? '.e2e-results');
  }
  private total = 0;
  private errors = 0;
  private records: {
    id: string;
    project: string;
    status: string;
    duration: number;
    retry: number;
  }[] = [];
  onBegin(_config: unknown, suite: Suite) {
    this.total = suite.allTests().length;
  }
  onError() {
    this.errors += 1;
  }
  onTestEnd(test: TestCase, result: TestResult) {
    this.records.push({
      id: test.title.split(' ')[0],
      project: test.parent.project()?.name ?? '',
      status: result.status,
      duration: result.duration,
      retry: result.retry,
    });
  }
  async onEnd(result: FullResult): Promise<{ status: 'passed' | 'failed' }> {
    const report = summarize(this.records, {
      total: this.total,
      status: result.status,
      errors: this.errors,
    });
    const directory = this.directory;
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      path.join(directory, 'results.json'),
      JSON.stringify(report, null, 2),
    );
    process.stdout.write(
      `E2E: ${report.passed}/${report.expected} passed; complete=${report.complete}\n`,
    );
    return { status: report.complete ? 'passed' : 'failed' };
  }
  // Intentionally ignore test stdout/stderr and raw error details.
}
