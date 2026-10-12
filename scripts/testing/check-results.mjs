import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function validateResults(report, runner) {
  if (!['jest', 'vitest'].includes(runner)) throw new Error('Runner inválido');
  const reject = () => {
    throw new Error(
      'Se requieren pruebas exitosas y un reporte completo sin omisiones',
    );
  };
  if (
    !report ||
    typeof report !== 'object' ||
    Array.isArray(report) ||
    report.success !== true
  )
    reject();
  const counters = [
    'numTotalTests',
    'numPassedTests',
    'numFailedTests',
    'numPendingTests',
    'numTodoTests',
    'numTotalTestSuites',
    'numPassedTestSuites',
    'numFailedTestSuites',
    'numPendingTestSuites',
  ];
  if (Object.hasOwn(report, 'numRuntimeErrorTestSuites'))
    counters.push('numRuntimeErrorTestSuites');
  for (const key of counters) {
    if (!Number.isSafeInteger(report[key]) || report[key] < 0) reject();
  }
  if (
    report.numTotalTests === 0 ||
    report.numTotalTestSuites === 0 ||
    report.numPassedTests !== report.numTotalTests ||
    report.numPassedTestSuites !== report.numTotalTestSuites ||
    report.numFailedTests !== 0 ||
    report.numPendingTests !== 0 ||
    report.numFailedTestSuites !== 0 ||
    report.numPendingTestSuites !== 0 ||
    (report.numTodoTests ?? 0) !== 0 ||
    (report.numRuntimeErrorTestSuites ?? 0) !== 0 ||
    (Object.hasOwn(report, 'wasInterrupted') && report.wasInterrupted !== false)
  )
    reject();

  if (!Array.isArray(report.testResults) || report.testResults.length === 0)
    reject();
  // Vitest incluye describe anidados en el contador de suites; Jest cuenta archivos.
  if (
    runner === 'jest' &&
    report.testResults.length !== report.numTotalTestSuites
  )
    reject();
  if (report.testResults.length > report.numTotalTestSuites) reject();
  let assertions = 0;
  for (const file of report.testResults) {
    if (
      !file ||
      file.status !== 'passed' ||
      file.testExecError ||
      !Array.isArray(file.assertionResults) ||
      file.assertionResults.length === 0
    )
      reject();
    for (const assertion of file.assertionResults) {
      if (!assertion || assertion.status !== 'passed') reject();
      assertions += 1;
    }
  }
  if (assertions !== report.numTotalTests) reject();
  return { tests: report.numTotalTests, suites: report.numTotalTestSuites };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const result = validateResults(
      JSON.parse(readFileSync(process.argv[3], 'utf8')),
      process.argv[2],
    );
    console.log(
      `${process.argv[2]}: ${result.tests} pruebas, ${result.suites} suites completas`,
    );
  } catch {
    console.error('Reporte de pruebas ausente, inválido o incompleto');
    process.exitCode = 1;
  }
}
