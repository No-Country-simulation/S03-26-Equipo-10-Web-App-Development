import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { validateResults } from './check-results.mjs';

function report(runner) {
  return {
    success: true,
    numTotalTests: 3,
    numPassedTests: 3,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    // Vitest cuenta también describe anidados; no es la cantidad de archivos.
    numTotalTestSuites: runner === 'vitest' ? 4 : 2,
    numPassedTestSuites: runner === 'vitest' ? 4 : 2,
    numFailedTestSuites: 0,
    numPendingTestSuites: 0,
    testResults: [
      {
        status: 'passed',
        assertionResults: [{ status: 'passed' }, { status: 'passed' }],
      },
      { status: 'passed', assertionResults: [{ status: 'passed' }] },
    ],
  };
}

for (const runner of ['jest', 'vitest']) {
  test(`${runner}: acepta un reporte completo nativo`, () => {
    const native = report(runner);
    assert.deepEqual(validateResults(native, runner), {
      tests: 3,
      suites: runner === 'vitest' ? 4 : 2,
    });
  });

  const invalid = {
    'runner fallido': (r) => {
      r.success = false;
    },
    'success no booleano': (r) => {
      r.success = 'true';
    },
    'sin pruebas': (r) => {
      r.numTotalTests = 0;
      r.numPassedTests = 0;
      r.testResults = [];
    },
    'prueba fallida': (r) => {
      r.numFailedTests = 1;
    },
    'prueba omitida': (r) => {
      r.numPendingTests = 1;
    },
    todo: (r) => {
      r.numTodoTests = 1;
    },
    'suite fallida': (r) => {
      r.numFailedTestSuites = 1;
    },
    'suite omitida': (r) => {
      r.numPendingTestSuites = 1;
    },
    'contador ausente': (r) => {
      delete r.numPassedTests;
    },
    'contador todo ausente': (r) => {
      delete r.numTodoTests;
    },
    'contador string': (r) => {
      r.numTotalTests = '3';
    },
    'contador negativo': (r) => {
      r.numFailedTests = -1;
    },
    'contador fraccionario': (r) => {
      r.numTotalTests = 3.5;
    },
    'conteo de aprobadas inconsistente': (r) => {
      r.numPassedTests = 2;
    },
    'conteo de suites inconsistente': (r) => {
      r.numPassedTestSuites = 1;
    },
    'sin suites': (r) => {
      r.numTotalTestSuites = 0;
      r.numPassedTestSuites = 0;
    },
    'detalle ausente': (r) => {
      delete r.testResults;
    },
    'detalle vacío': (r) => {
      r.testResults = [];
    },
    'archivo fallido con contadores verdes': (r) => {
      r.testResults[0].status = 'failed';
    },
    'assertion omitida con contadores verdes': (r) => {
      r.testResults[0].assertionResults[0].status = 'pending';
    },
    'assertion todo con contadores verdes': (r) => {
      r.testResults[0].assertionResults[0].status = 'todo';
    },
    'detalle truncado': (r) => {
      r.testResults.pop();
    },
    'error al cargar suite': (r) => {
      r.testResults[0].testExecError = { message: 'fixture' };
    },
    'errores de runtime': (r) => {
      r.numRuntimeErrorTestSuites = 1;
    },
    'ejecución interrumpida': (r) => {
      r.wasInterrupted = true;
    },
    'contador todo inválido': (r) => {
      r.numTodoTests = null;
    },
  };
  for (const [scenario, mutate] of Object.entries(invalid)) {
    test(`${runner}: rechaza ${scenario}`, () => {
      const candidate = report(runner);
      mutate(candidate);
      assert.throws(() => validateResults(candidate, runner));
    });
  }
}

test('rechaza estructuras ajenas al reporte y runners desconocidos', () => {
  for (const value of [null, [], 'passed', {}]) {
    assert.throws(() => validateResults(value, 'jest'));
  }
  assert.throws(() => validateResults(report('jest'), 'other'));
});

test('CLI falla ante reporte ausente o JSON inválido y acepta uno completo', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'testing-results-'));
  const file = path.join(directory, 'report.json');
  const script = fileURLToPath(new URL('./check-results.mjs', import.meta.url));
  const run = () =>
    spawnSync(process.execPath, [script, 'vitest', file], { encoding: 'utf8' });
  try {
    assert.equal(run().status, 1);
    writeFileSync(file, '{ invalid');
    assert.equal(run().status, 1);
    writeFileSync(file, JSON.stringify(report('vitest')));
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /3 pruebas, 4 suites completas/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
