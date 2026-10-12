export type EvidenceRecord = {
  id: string;
  project: string;
  status: string;
  duration: number;
  retry: number;
};
export type Evidence = {
  complete: boolean;
  expected: number;
  executed: number;
  passed: number;
  cases: {
    id: string;
    project: string;
    status: string;
    durationMs: number;
    retry: number;
  }[];
};
export function summarize(
  records: EvidenceRecord[],
  options: { total: number; status: string; errors?: number },
): Evidence;
