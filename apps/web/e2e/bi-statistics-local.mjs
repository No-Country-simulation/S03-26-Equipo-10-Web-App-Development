// Manual opt-in against test/bi-statistics-browser.ts and local web. Real HTTP/cookies; no intercepted responses.
import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
if (process.argv[2] !== '--run')
  throw new Error('BI_STATISTICS_BROWSER_OPT_IN_REQUIRED');
const web = 'http://127.0.0.1:3105';
const api = 'http://127.0.0.1:4105/api/v1';
function csv(text) {
  const rows = [];
  let row = [];
  for (const match of text.matchAll(/"((?:[^"]|"")*)"(,|\r\n)/g)) {
    row.push(match[1].replaceAll('""', '"'));
    if (match[2] === '\r\n') {
      rows.push(row);
      row = [];
    }
  }
  const headers = rows.shift();
  return rows.map((values) =>
    Object.fromEntries(headers.map((name, i) => [name, values[i]])),
  );
}
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.TEST_CHROME_EXECUTABLE || undefined,
});
const contexts = [];
async function login(role, index, width = 1440) {
  const context = await browser.newContext({
    viewport: { width, height: width < 500 ? 844 : 1000 },
  });
  contexts.push(context);
  const page = await context.newPage();
  await page.goto(web + '/admin/login');
  await page
    .getByLabel('Email', { exact: true })
    .fill(`${role}-bi-${index}@example.test`);
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('Synthetic-BI-Only-2026!');
  await page
    .getByRole('button', { name: 'Iniciar sesión', exact: true })
    .click();
  await page.waitForURL(web + '/admin');
  return { page, context };
}
try {
  const admin = await login('admin', 0);
  await admin.page.goto(web + '/admin/business-intelligence?view=operation');
  await expect(
    admin.page.getByRole('button', { name: 'Ejecutar ahora', exact: true }),
  ).toBeEnabled({ timeout: 30000 });
  await admin.page
    .getByRole('button', { name: 'Ejecutar ahora', exact: true })
    .click();
  await admin.page.waitForURL(/request=/);
  const requestId = new URL(admin.page.url()).searchParams.get('request');
  expect(requestId).toMatch(/^[a-f0-9-]{36}$/);
  await admin.context.close();
  const editor = await login('editor', 0, 390);
  await expect
    .poll(
      async () => {
        const response = await editor.page.request.get(api + '/bi/statistics');
        expect(response.status()).toBe(200);
        return (await response.json()).data.publicationStatus;
      },
      { timeout: 60000, intervals: [1000] },
    )
    .toBe('current');
  const payload = (
    await (await editor.page.request.get(api + '/bi/statistics')).json()
  ).data;
  expect(payload.patterns.totalTestimonials).toBe('100');
  expect(payload.forecast.value).toBeNull();
  await editor.page.goto(web + '/admin/business-intelligence?view=statistics');
  await expect(
    editor.page.getByRole('button', { name: 'Patrones CSV' }),
  ).toBeEnabled();
  expect(
    await editor.page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  const results = {};
  for (const [section, label] of [
    ['forecast', 'Pronóstico'],
    ['patterns', 'Patrones'],
    ['anomalies', 'Anomalías'],
  ]) {
    const [download] = await Promise.all([
      editor.page.waitForEvent('download'),
      editor.page.getByRole('button', { name: `${label} CSV` }).click(),
    ]);
    const content = await readFile(await download.path(), 'utf8');
    expect(content.startsWith('\uFEFF')).toBe(true);
    expect(content).not.toMatch(
      /Private synthetic|authorName|postgresql:|password/,
    );
    const rows = csv(content);
    expect(
      rows.every(
        (row) => row.corte_origen_utc === payload.publication.sourceSnapshotAt,
      ),
    ).toBe(true);
    if (section === 'patterns') {
      const pair = rows.find((row) => row.tipo === 'par');
      expect(pair).toMatchObject({
        cantidad: '10',
        soporte_porcentaje: '10',
        confianza_ab_porcentaje: '25',
        confianza_ba_porcentaje: '50',
        lift: '1.25',
      });
      expect(rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tipo: 'categoria',
            nombre: "'=Categoría sintética",
          }),
        ]),
      );
    }
    if (section === 'forecast')
      expect(rows[0]).toMatchObject({
        tipo: 'pronostico',
        cantidad: '',
        motivo: 'INSUFFICIENT_HISTORY',
      });
    if (section === 'anomalies') expect(rows).toHaveLength(180);
    results[section] = { rows: rows.length, matchesSource: true };
  }
  await editor.page
    .getByText('Consultar las señales y referencias de los 90 días')
    .click();
  await expect(
    editor.page.getByRole('table', {
      name: 'Señales diarias y referencia estadística',
    }),
  ).toBeVisible();
  const foreign = await login('admin', 1);
  await foreign.page.goto(web + '/admin/business-intelligence?view=statistics');
  await expect(foreign.page.getByText(/Sin cortes observados/)).toBeVisible();
  await expect(
    foreign.page.getByRole('button', { name: 'Patrones CSV' }),
  ).toBeDisabled();
  const reopened = await login('admin', 0);
  const detail = await reopened.page.request.get(
    api + '/bi/requests/' + requestId,
  );
  expect(detail.status()).toBe(200);
  expect((await detail.json()).data.request.status).toBe('succeeded');
  await reopened.page.goto(
    web + '/admin/business-intelligence?view=statistics',
  );
  await expect(
    reopened.page.getByRole('button', { name: 'Anomalías CSV' }),
  ).toBeEnabled();
  expect(
    await reopened.page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  console.log(
    JSON.stringify({
      passed: true,
      realBackend: true,
      roles: ['admin', 'editor'],
      tenants: 2,
      viewports: [1440, 390],
      closedPendingSessionRecovered: true,
      csv: results,
    }),
  );
} finally {
  await Promise.allSettled(contexts.map((context) => context.close()));
  await browser.close();
}
