export function restoreEnvironment(previous: {
  BI_ENABLED: string | undefined; BI_OPERATIONS_ENABLED: string | undefined; BI_CONTROL_DATABASE_URL: string | undefined;
}): void {
  if (previous.BI_ENABLED === undefined) delete process.env.BI_ENABLED; else process.env.BI_ENABLED = previous.BI_ENABLED;
  if (previous.BI_OPERATIONS_ENABLED === undefined) delete process.env.BI_OPERATIONS_ENABLED; else process.env.BI_OPERATIONS_ENABLED = previous.BI_OPERATIONS_ENABLED;
  if (previous.BI_CONTROL_DATABASE_URL === undefined) delete process.env.BI_CONTROL_DATABASE_URL; else process.env.BI_CONTROL_DATABASE_URL = previous.BI_CONTROL_DATABASE_URL;
}
