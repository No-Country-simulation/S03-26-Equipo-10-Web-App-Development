import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  login,
  billing,
  plan,
  checkout,
  seed,
  enable,
  write,
  tick,
  simulate,
  summary,
} from './fixtures';

test('BILLING-CATALOG operador independiente y catálogo durable tras reinicio', async ({
  page,
  operator,
  tenant,
}) => {
  await login(page, seed().credentials);
  await page.goto('/platform/billing');
  await expect(
    page.getByRole('heading', { name: 'Catálogo versionado', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Lista para contratar', { exact: false }),
  ).toHaveCount(2);
  expect((await tenant.owner.get('/api/v1/platform/billing')).status()).toBe(
    403,
  );
  const code = `browser-${randomUUID()}`;
  await page.getByLabel('Código de un nuevo plan').fill(code);
  await page.getByRole('button', { name: 'Crear plan', exact: true }).click();
  await expect
    .poll(async () => {
      const result = await (
        await operator.get('/api/v1/platform/billing/catalog')
      ).json();
      return result.data.some((p: { code: string }) => p.code === code);
    })
    .toBe(true);
  const key = randomUUID();
  const body = { code: `stable-${randomUUID()}` };
  const a = await write(
    operator,
    '/platform/billing/plans',
    body,
    201,
    'POST',
    key,
  );
  const b = await write(
    operator,
    '/platform/billing/plans',
    body,
    201,
    'POST',
    key,
  );
  expect((await b.json()).data.id).toBe((await a.json()).data.id);
  const r = await operator.post('/api/v1/platform/billing/plans', {
    data: { code: `other-${randomUUID()}` },
    headers: { 'Idempotency-Key': key },
  });
  expect(r.status()).toBe(409);
});

test('BILLING-STRIPE-MANUAL prueba única, cuota, pago y devolución total', async ({
  page,
  operator,
  tenant,
}) => {
  await enable(operator, tenant);
  await billing(page, tenant.account);
  await plan(page)
    .getByRole('button', { name: 'Probar 14 días sin tarjeta' })
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Iniciar prueba sin tarjeta', exact: true })
    .click();
  await expect
    .poll(async () => (await summary(tenant)).access.mode)
    .toBe('trial');
  await tenant.createDraft('Contenido sintético de aceptación de facturación.');
  const csrf = (await (await tenant.owner.get('/api/v1/auth/csrf')).json()).data
    .csrfToken;
  const extra = await tenant.owner.post('/api/v1/testimonials', {
    data: {
      content: 'Segundo contenido que excede la capacidad.',
      authorName: 'Sintético',
      rating: 5,
    },
    headers: { 'x-csrf-token': csrf },
  });
  expect(extra.status()).toBe(409);
  const again = await tenant.owner.post('/api/v1/billing/trial', {
    data: { planVersionId: seed().versionId },
    headers: { 'x-csrf-token': csrf, 'Idempotency-Key': randomUUID() },
  });
  expect(again.status()).toBe(409);
  const id = await checkout(page, 'USD', 'manual');
  expect((await summary(tenant)).access.mode).toBe('trial');
  const foreign = await operator.get(`/api/v1/billing/operations/${id}`);
  expect(foreign.status()).toBe(404);
  await simulate(operator, id, 'approved');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Pago confirmado', exact: true }),
  ).toBeVisible();
  expect((await summary(tenant)).access.mode).toBe('paid');
  await simulate(operator, id, 'approved');
  const payments = (
    await (await tenant.owner.get('/api/v1/billing/payments')).json()
  ).data;
  expect(payments.total).toBe(1);
  await simulate(operator, id, 'full_refund');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Pago revertido', exact: true }),
  ).toBeVisible();
  expect((await summary(tenant)).access.mode).toBe('read_only');
});

test('BILLING-MP-AUTOMATIC adhesión, renovación simulada y cancelación durable', async ({
  page,
  operator,
  tenant,
}) => {
  await enable(operator, tenant);
  await billing(page, tenant.account);
  const id = await checkout(page, 'ARS', 'automatic');
  const initial = new Date();
  await simulate(operator, id, 'approved', initial);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Pago confirmado', exact: true }),
  ).toBeVisible();
  const before = await summary(tenant);
  const next = new Date(before.subscription.paidThrough);
  await simulate(operator, id, 'rejected', next, 'second');
  expect((await summary(tenant)).subscription.paidThrough).toBe(
    before.subscription.paidThrough,
  );
  await simulate(operator, id, 'approved', next, 'second');
  const renewed = await summary(tenant);
  expect(new Date(renewed.subscription.paidThrough).getTime()).toBeGreaterThan(
    next.getTime(),
  );
  await page.goto('/admin/billing');
  await page
    .getByRole('button', { name: 'Detener renovación', exact: true })
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Detener renovación', exact: true })
    .click();
  await tick();
  await page.reload();
  const after = await summary(tenant);
  expect(after.subscription.renewalStoppedAt).not.toBeNull();
  expect(after.subscription.paidThrough).toBe(renewed.subscription.paidThrough);
  expect(after.access.mode).toBe('paid');
});

test('BILLING-RECOVERY retorno manipulado no acredita; rechazo y recuperación manual', async ({
  page,
  operator,
  tenant,
}) => {
  await enable(operator, tenant);
  await billing(page, tenant.account);
  const id = await checkout(page, 'USD', 'manual');
  await page.goto(
    `/admin/billing/return?operation=${id}&status=approved&payment_status=paid`,
  );
  await expect(
    page.getByRole('heading', { name: 'Confirmación pendiente', exact: true }),
  ).toBeVisible();
  expect((await summary(tenant)).access.mode).toBe('read_only');
  await simulate(operator, id, 'rejected');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'El pago no fue aprobado', exact: true }),
  ).toBeVisible();
  // A separate durable worker process handles pending catalog/cancellation jobs without a second debit engine.
  await tick();
  await simulate(operator, id, 'approved');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Pago confirmado', exact: true }),
  ).toBeVisible();
  expect((await summary(tenant)).access.mode).toBe('paid');
  const csrf = (await (await tenant.owner.get('/api/v1/auth/csrf')).json()).data
    .csrfToken;
  const invalid = await tenant.owner.post('/api/v1/billing/checkouts', {
    data: { priceId: seed().prices[0]!.id, mode: 'manual', amountMinor: '1' },
    headers: { 'Idempotency-Key': randomUUID(), 'x-csrf-token': csrf },
  });
  expect(invalid.status()).toBe(400);
});
