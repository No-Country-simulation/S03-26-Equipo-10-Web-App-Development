import {
  test,
  expect,
  billing,
  plan,
  checkout,
  enable,
  simulate,
  expectNoOverflow,
} from './fixtures';
test('BILLING-MOBILE selección, confirmación y estado de error a 390px', async ({
  page,
  operator,
  tenant,
}) => {
  await enable(operator, tenant);
  await billing(page, tenant.account);
  await expectNoOverflow(page);
  await plan(page)
    .getByRole('button', { name: 'Probar 14 días sin tarjeta' })
    .focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(
    plan(page).getByRole('button', { name: 'Probar 14 días sin tarjeta' }),
  ).toBeFocused();
  const id = await checkout(page, 'ARS', 'manual');
  await expectNoOverflow(page);
  await simulate(operator, id, 'rejected');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'El pago no fue aprobado', exact: true }),
  ).toBeVisible();
  await expectNoOverflow(page);
});
