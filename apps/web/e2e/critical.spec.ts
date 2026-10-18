import { z } from 'zod';
import {
  test,
  expect,
  login,
  responseData,
  recordSchema,
  tenantSchema,
  browserCall,
  credentials,
} from './fixtures';

test('E2E-SESSION login, recarga, rotación y revocación al cerrar sesión', async ({
  page,
  context,
  tenant,
  playwright,
  baseURL,
}) => {
  await login(page, tenant.account);
  const authCookies = (await context.cookies()).filter((cookie) =>
    ['accessToken', 'refreshToken'].includes(cookie.name),
  );
  expect(authCookies.length).toBe(2);
  expect(
    authCookies.every(
      (cookie) =>
        cookie.secure &&
        cookie.httpOnly &&
        cookie.sameSite === 'Strict' &&
        cookie.path === '/',
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () =>
        !document.cookie.includes('accessToken=') &&
        !document.cookie.includes('refreshToken='),
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole('navigation', { name: 'Navegación del panel', exact: true }),
  ).toBeVisible();
  // Exercise reactive recovery without waiting 15 minutes or changing JWT TTL.
  const previousRefresh = authCookies.find(
    (cookie) => cookie.name === 'refreshToken',
  )?.value;
  await context.clearCookies({ name: 'accessToken' });
  const rotated = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/auth/refresh') &&
      response.request().method() === 'POST',
  );
  await page.reload();
  expect((await rotated).status()).toBe(201);
  await expect(
    page.getByRole('navigation', { name: 'Navegación del panel', exact: true }),
  ).toBeVisible();
  const currentRefresh = (await context.cookies()).find(
    (cookie) => cookie.name === 'refreshToken',
  )?.value;
  expect(
    Boolean(
      currentRefresh && previousRefresh && currentRefresh !== previousRefresh,
    ),
  ).toBe(true);
  await page
    .getByRole('button', { name: 'Cerrar Sesión', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect(
    (await context.cookies()).some((cookie) =>
      ['accessToken', 'refreshToken'].includes(cookie.name),
    ),
  ).toBe(false);
  expect((await context.request.get('/api/v1/auth/me')).status()).toBe(401);
  // Cookie removal alone is insufficient: the server must revoke the family.
  const replay = await playwright.request.newContext({
    baseURL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { 'X-Auth-Mode': 'bearer', Origin: baseURL! },
  });
  try {
    expect(
      (
        await replay.post('/api/v1/auth/refresh', {
          data: { refreshToken: currentRefresh },
        })
      ).status(),
    ).toBe(401);
  } finally {
    await replay.dispose();
  }
  await page.goto('/admin/testimonials');
  await expect(
    page.getByRole('button', { name: 'Iniciar Sesión', exact: true }),
  ).toBeVisible();
});

test('E2E-PUBLISH captura, aprobación y publicación persisten y aparecen en el muro', async ({
  page,
  context,
  tenant,
}) => {
  const authorName = 'Autor de recorrido';
  const content = 'El recorrido conserva este testimonio después de recargar.';
  await page.goto(`/p/${tenant.slug}`);
  await page.getByLabel('Contanos tu historia', { exact: true }).fill(content);
  await page.getByLabel('Tu Nombre Completo', { exact: true }).fill(authorName);
  const submission = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/${tenant.slug}/submit`) &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Enviar testimonio', exact: true })
    .click();
  const response = await submission;
  expect(response.status()).toBe(201);
  const submitted = z
    .object({
      success: z.literal(true),
      data: z.object({
        status: z.literal('success'),
        id: z.string().uuid(),
        failedMedia: z.array(z.string()).length(0),
      }),
    })
    .parse(await response.json());
  await expect(
    page.getByRole('heading', { name: '¡Muchas gracias!', exact: true }),
  ).toBeFocused();
  const path = `/testimonials/${submitted.data.id}`;
  expect((await tenant.get(path, recordSchema)).status).toBe('pending');
  const publicPath = `/api/v1/public/testimonials/tenants/${tenant.slug}`;
  expect(
    await responseData(
      await context.request.get(publicPath),
      z.array(recordSchema),
    ),
  ).toEqual([]);
  expect(
    (await context.request.get(`${publicPath}/${submitted.data.id}`)).status(),
  ).toBe(404);
  await login(page, tenant.account);
  await page.goto('/admin/testimonials');
  await page
    .getByLabel('Buscar por autor o contenido', { exact: true })
    .fill(authorName);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(/q=Autor\+de\+recorrido/);
  const row = page.getByRole('row').filter({ hasText: authorName });
  await expect(row).toContainText('Pendiente de revisión');
  await row
    .getByRole('button', { name: 'Abrir Testimonio', exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`testimonial=${submitted.data.id}`));
  await expect(
    page.getByRole('dialog', { name: `Testimonio de ${authorName}` }),
  ).toBeVisible();
  // The detail must remain reachable through the URL after a full reload.
  await page.reload();
  await expect(
    page.getByRole('dialog', { name: `Testimonio de ${authorName}` }),
  ).toBeVisible();
  const approved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`${submitted.data.id}/approve`) &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Aprobar', exact: true }).click();
  expect((await approved).status()).toBe(201);
  await page.keyboard.press('Escape');
  await expect(row).toContainText('Aprobado');
  expect((await tenant.get(path, recordSchema)).status).toBe('approved');
  expect(
    await responseData(
      await context.request.get(publicPath),
      z.array(recordSchema),
    ),
  ).toEqual([]);
  // Reload the administrative screen before the final transition.
  await page.reload();
  await row
    .getByRole('button', { name: 'Abrir Testimonio', exact: true })
    .click();
  const published = page.waitForResponse(
    (response) =>
      response.url().endsWith(`${submitted.data.id}/publish`) &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Publicar Ahora', exact: true })
    .click();
  expect((await published).status()).toBe(201);
  await page.keyboard.press('Escape');
  await expect(row).toContainText('Publicado');
  expect((await tenant.get(path, recordSchema)).status).toBe('published');
  // A new anonymous context proves public access independently of admin cookies.
  const anonymous = await page
    .context()
    .browser()!
    .newContext({
      baseURL: new URL(page.url()).origin,
      ignoreHTTPSErrors: true,
    });
  try {
    const wall = await anonymous.newPage();
    await wall.goto(`/t/${tenant.slug}`);
    await expect(wall.getByText(content, { exact: false })).toBeVisible();
    await wall.reload();
    await expect(wall.getByText(content, { exact: false })).toBeVisible();
    const records = await responseData(
      await anonymous.request.get(publicPath),
      z.array(z.object({ id: z.string(), content: z.string() })),
    );
    expect(records).toEqual([{ id: submitted.data.id, content }]);
  } finally {
    await anonymous.close();
  }
});

test('E2E-TENANT-CSRF deniega tenant ajeno y CSRF sin modificar datos', async ({
  page,
  context,
  tenant,
  createPeer,
  baseURL,
}) => {
  const peer = await createPeer();
  const own = await tenant.createDraft(
    'Contenido propio que debe permanecer sin cambios.',
  );
  const foreign = await peer.createDraft(
    'Contenido ajeno que debe permanecer sin cambios.',
  );
  const peerId = (await peer.get('/tenants/me', tenantSchema)).id;
  await login(page, tenant.account);
  expect(await browserCall(page, { path: `/testimonials/${foreign.id}` })).toBe(
    404,
  );
  expect(
    await browserCall(page, {
      path: `/testimonials/${foreign.id}`,
      method: 'PATCH',
      csrf: true,
      forgeTenant: peerId,
      data: { content: 'Cambio ajeno prohibido por aislamiento.' },
    }),
  ).toBe(404);
  expect(
    await browserCall(page, {
      path: `/testimonials/${own.id}`,
      method: 'PATCH',
      data: { content: 'Cambio propio prohibido sin CSRF.' },
    }),
  ).toBe(403);
  const { csrfToken } = await responseData(
    await context.request.get('/api/v1/auth/csrf'),
    z.object({ csrfToken: z.string() }),
  );
  expect(
    (
      await context.request.patch(`/api/v1/testimonials/${own.id}`, {
        data: { content: 'Cambio prohibido por Origin ajeno.' },
        headers: {
          Origin: 'https://foreign.example.test',
          'x-csrf-token': csrfToken,
        },
      })
    ).status(),
  ).toBe(403);
  expect(await tenant.get(`/testimonials/${own.id}`, recordSchema)).toEqual(
    own,
  );
  expect(await peer.get(`/testimonials/${foreign.id}`, recordSchema)).toEqual(
    foreign,
  );
  const visible = await responseData(
    await context.request.get('/api/v1/testimonials'),
    z.array(recordSchema),
  );
  expect(visible.map((record) => record.id)).toEqual([own.id]);
  expect(new URL(page.url()).origin).toBe(baseURL);
});

test('E2E-RBAC editor sin permisos de usuarios ni configuración de tenant', async ({
  page,
  tenant,
}) => {
  const editor = credentials();
  const userSchema = z.object({
    id: z.string(),
    email: z.string(),
    roles: z.array(z.string()),
  });
  const createdEditor = await tenant.write(
    'POST',
    '/users',
    { ...editor, role: 'editor' },
    userSchema,
  );
  const beforeUsers = await tenant.get('/users', z.array(userSchema));
  const beforeTenant = await tenant.get('/tenants/me', tenantSchema);
  await login(page, editor);
  const navigation = page.getByRole('navigation', {
    name: 'Navegación del panel',
    exact: true,
  });
  await expect(
    navigation.getByRole('link', { name: 'Usuarios', exact: true }),
  ).toHaveCount(0);
  // A legitimate editor write proves that the 403 below is a permission
  // denial, rather than every mutation failing because of a broken session/CSRF.
  expect(
    await browserCall(page, {
      path: '/testimonials',
      method: 'POST',
      csrf: true,
      data: {
        content: 'Creación permitida al editor autenticado.',
        authorName: 'Editor sintético',
        rating: 5,
      },
    }),
  ).toBe(201);
  expect(
    await browserCall(page, {
      path: '/users',
      method: 'POST',
      csrf: true,
      data: { ...credentials(), role: 'admin' },
    }),
  ).toBe(403);
  expect(
    await browserCall(page, {
      path: '/tenants/me',
      method: 'PATCH',
      csrf: true,
      data: { name: 'Cambio de configuración prohibido' },
    }),
  ).toBe(403);
  expect(await tenant.get('/users', z.array(userSchema))).toEqual(beforeUsers);
  expect(await tenant.get('/tenants/me', tenantSchema)).toEqual(beforeTenant);
  // Direct navigation does not grant an editor the administrative users view.
  await page.goto('/admin/users');
  await expect(
    page.getByRole('heading', { name: 'Acceso denegado', exact: true }),
  ).toBeVisible();
  const accessSchema = userSchema.extend({ isActive: z.boolean() });
  const disabled = await tenant.write(
    'PATCH',
    `/users/${createdEditor.id}`,
    { isActive: false },
    accessSchema,
  );
  expect(disabled.isActive).toBe(false);
  expect(disabled.roles).toEqual(['editor']);
  // The same already-issued browser credential must stop working immediately.
  expect((await page.context().request.get('/api/v1/auth/me')).status()).toBe(
    401,
  );
  const enabled = await tenant.write(
    'PATCH',
    `/users/${createdEditor.id}`,
    { isActive: true },
    accessSchema,
  );
  expect(enabled.isActive).toBe(true);
  expect(enabled.roles).toEqual(['editor']);
  // Reactivation permits a still-valid session; it does not permanently revoke it.
  expect((await page.context().request.get('/api/v1/auth/me')).status()).toBe(
    200,
  );
});
