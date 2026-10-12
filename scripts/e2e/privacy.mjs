/** Preserve failure semantics while removing rich errors before Playwright writes error-context.md. */
export function redactErrors(errors) {
  for (const error of errors) {
    const line = error.location?.line;
    const source =
      typeof error.stack === 'string'
        ? error.stack.match(
            /\/(fixtures\.ts|critical\.spec\.ts|mobile\.spec\.ts):(\d+):\d+/,
          )
        : null;
    for (const key of Object.keys(error)) delete error[key];
    error.message = source
      ? `E2E failed at ${source[1]}:${Number(source[2])}; sensitive diagnostics withheld`
      : Number.isSafeInteger(line) && line > 0
        ? `E2E assertion failed at line ${line}; sensitive diagnostics withheld`
        : 'E2E failed; sensitive diagnostics withheld';
  }
}
