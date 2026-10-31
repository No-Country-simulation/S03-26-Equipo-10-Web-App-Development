export const cases: Record<string, string>;
export function summarize(
  records: Array<{
    id: string;
    project: string;
    status: string;
    retry: number;
    duration: number;
  }>,
  options: { status: string; total: number; errors?: number },
): {
  complete: boolean;
  expected: number;
  executed: number;
  passed: number;
  cases: Array<{
    id: string;
    project: string;
    status: string;
    retry: number;
    durationMs: number;
  }>;
};
