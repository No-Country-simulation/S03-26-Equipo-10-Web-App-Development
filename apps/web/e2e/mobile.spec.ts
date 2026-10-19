import {
  test,
  expect,
  login,
  expectNoOverflow,
  recordSchema,
} from './fixtures';

test('E2E-MOBILE-MENU abre con Enter, cierra con Escape y devuelve el foco', async ({
  page,
  tenant,
}) => {
  await login(page, tenant.account);
  await expectNoOverflow(page);
  const trigger = page.getByRole('button', {
    name: 'Abrir menú del panel',
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', {
    name: 'Navegación del panel',
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('link', { name: 'Testimonios', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  await dialog.getByRole('link', { name: 'Testimonios', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/testimonials$/);
  await expect(dialog).not.toBeVisible();
  await expectNoOverflow(page);
});

test('E2E-MOBILE-CAPTURE tabula, envía y conserva el testimonio sin desbordamiento', async ({
  page,
  tenant,
}) => {
  const content = 'La captura móvil conserva el contenido enviado por teclado.';
  await page.goto(`/p/${tenant.slug}`);
  const story = page.getByLabel('Contanos tu historia', { exact: true });
  const author = page.getByLabel('Tu Nombre Completo', { exact: true });
  await page
    .getByRole('radio', { name: '4 estrellas', exact: true })
    .press('Space');
  await expect(story).toBeVisible();
  await expectNoOverflow(page);
  await story.focus();
  await page.keyboard.type(content);
  await page.keyboard.press('Tab');
  await expect(author).toBeFocused();
  await page.keyboard.type('Autor móvil sintético');
  await page.keyboard.press('Tab'); // optional image
  await page.keyboard.press('Tab'); // optional video
  await page.keyboard.press('Tab'); // submit
  await expect(
    page.getByRole('button', { name: 'Enviar testimonio', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: '¡Muchas gracias!', exact: true }),
  ).toBeFocused();
  await page.reload();
  await expect(story).toBeVisible();
  await expectNoOverflow(page);
  const stored = await tenant.get('/testimonials', recordSchema.array());
  expect(
    stored.map((record) => ({
      content: record.content,
      status: record.status,
    })),
  ).toEqual([{ content, status: 'pending' }]);
});
