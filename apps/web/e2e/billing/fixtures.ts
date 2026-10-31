import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { APIRequestContext, Page } from '@playwright/test';
import {
  test as base,
  expect,
  login,
  expectNoOverflow,
  responseData,
  type TenantFixture,
} from '../fixtures';
const seedSchema = z.object({
  credentials: z.object({ email: z.string(), password: z.string() }),
  operatorToken: z.string(),
  actorId: z.string().uuid(),
  planId: z.string().uuid(),
  versionId: z.string().uuid(),
  prices: z.array(
    z.object({
      id: z.string().uuid(),
      provider: z.enum(['stripe', 'mercadopago']),
    }),
  ),
});
export function seed() {
  if (!/^[a-f0-9]{12}$/.test(process.env.E2E_MANAGED_RUN ?? ''))
    throw Error('OWNED_HARNESS_REQUIRED');
  return seedSchema.parse(JSON.parse(process.env.BILLING_E2E_SEED ?? 'null'));
}
export const test = base.extend<{ operator: APIRequestContext }>({
  operator: async ({ playwright, baseURL }, provide) => {
    const c = await playwright.request.newContext({
      baseURL,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        Origin: baseURL!,
        Authorization: `Bearer ${seed().operatorToken}`,
      },
    });
    try {
      await provide(c);
    } finally {
      await c.dispose();
    }
  },
});
export async function write(
  c: APIRequestContext,
  path: string,
  data: object,
  status = 202,
  method = 'POST',
  key = randomUUID(),
) {
  const r = await c.fetch('/api/v1' + path, {
    method,
    data,
    headers: { 'Idempotency-Key': key },
  });
  expect(r.status(), 'financial HTTP contract').toBe(status);
  return r;
}
export async function enable(
  operator: APIRequestContext,
  tenant: TenantFixture,
) {
  const me = await responseData(
    await tenant.owner.get('/api/v1/auth/me'),
    z.object({ user: z.object({ tenantId: z.string().uuid() }) }),
  );
  const p = await (
    await operator.get(`/api/v1/platform/billing/tenants/${me.user.tenantId}`)
  ).json();
  await write(
    operator,
    `/platform/billing/tenants/${me.user.tenantId}/policy`,
    { expectedRevision: p.data.revision, enforcementEnabled: true },
    202,
    'PATCH',
  );
}
export async function tick() {
  seed();
  try {
    await promisify(execFile)(
      process.execPath,
      [
        resolve('../api/dist/modules/billing/worker.cli.js'),
        '--once',
        seed().actorId,
        '--apply',
      ],
      {
        env: {
          NODE_ENV: 'test',
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          BILLING_MODE: 'simulation',
          BILLING_CONFIG_JSON: process.env.BILLING_CONFIG_JSON,
          BILLING_WORKER_DATABASE_URL: process.env.BILLING_WORKER_DATABASE_URL,
        },
      },
    );
  } catch {
    throw Error('BOUNDED_FINANCIAL_WORKER_FAILED');
  }
}
export async function simulate(
  operator: APIRequestContext,
  id: string,
  scenario: string,
  at = new Date(),
  cycle = 'initial',
) {
  await write(operator, `/platform/billing/operations/${id}/simulate`, {
    scenario,
    at: at.toISOString(),
    cycle,
  });
}
export async function summary(tenant: TenantFixture) {
  return (await (await tenant.owner.get('/api/v1/billing/summary')).json())
    .data;
}
export async function billing(page: Page, account: TenantFixture['account']) {
  await login(page, account);
  await page.goto('/admin/billing');
  await expect(
    page.getByRole('heading', { name: 'Facturación', exact: true }),
  ).toBeVisible();
}
export function plan(page: Page) {
  return page.getByRole('article').filter({
    has: page.getByRole('heading', {
      name: 'Plan de aceptación local',
      exact: true,
    }),
  });
}
export async function checkout(
  page: Page,
  currency: 'ARS' | 'USD',
  mode: 'manual' | 'automatic',
) {
  await page.getByRole('combobox', { name: /^Moneda/ }).selectOption(currency);
  await page.getByRole('combobox', { name: /^Modalidad/ }).selectOption(mode);
  await plan(page)
    .getByRole('button', { name: 'Seleccionar plan', exact: true })
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Continuar al pago', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/billing\/return\?operation=/);
  await expect(
    page.getByRole('heading', { name: 'Confirmación pendiente', exact: true }),
  ).toBeVisible();
  return z
    .string()
    .uuid()
    .parse(new URL(page.url()).searchParams.get('operation'));
}
export { expect, login, expectNoOverflow };
