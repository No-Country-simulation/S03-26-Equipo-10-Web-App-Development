import { randomBytes, randomUUID } from 'node:crypto';
import {
  test as base,
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page,
  type PlaywrightWorkerArgs,
} from '@playwright/test';
import { z } from 'zod';
import { validateOrigin } from '../../../scripts/e2e/managed.mjs';
import { redactErrors } from '../../../scripts/e2e/privacy.mjs';

export const recordSchema = z.object({
  id: z.string().uuid(),
  authorName: z.string(),
  content: z.string(),
  status: z.string(),
});
export const tenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  publicSlug: z.string(),
  isPublicFormEnabled: z.boolean(),
});
const sessionSchema = z.object({
  user: z.object({ id: z.string(), tenantId: z.string() }),
});
export async function responseData<T>(
  response: APIResponse,
  schema: z.ZodType<T>,
  status = 200,
): Promise<T> {
  expect(response.status(), 'HTTP contract').toBe(status);
  const payload: unknown = await response.json();
  const envelope = z
    .object({ success: z.literal(true), data: z.unknown() })
    .parse(payload);
  return schema.parse(envelope.data);
}
export function credentials() {
  return {
    email: `e2e-${randomUUID()}@example.test`,
    password: `Aa1!${randomBytes(24).toString('base64url')}`,
  };
}
export class TenantFixture {
  constructor(
    readonly owner: APIRequestContext,
    readonly account: ReturnType<typeof credentials>,
    readonly slug: string,
    readonly name: string,
  ) {}
  async get<T>(path: string, schema: z.ZodType<T>) {
    return responseData(await this.owner.get(`/api/v1${path}`), schema);
  }
  async write<T>(
    method: 'POST' | 'PATCH',
    path: string,
    data: object,
    schema: z.ZodType<T>,
    status = method === 'POST' ? 201 : 200,
  ) {
    const { csrfToken } = await this.get(
      '/auth/csrf',
      z.object({ csrfToken: z.string() }),
    );
    return responseData(
      await this.owner.fetch(`/api/v1${path}`, {
        method,
        data,
        headers: { 'x-csrf-token': csrfToken },
      }),
      schema,
      status,
    );
  }
  async createDraft(content: string) {
    return this.write(
      'POST',
      '/testimonials',
      { content, authorName: 'Autor sintético', rating: 5 },
      recordSchema,
    );
  }
}
export const test = base.extend<{
  tenant: TenantFixture;
  createPeer: () => Promise<TenantFixture>;
}>({
  createPeer: async ({ playwright, baseURL }, provide) => {
    if (!/^[a-f0-9]{12}$/.test(process.env.E2E_MANAGED_RUN ?? ''))
      throw new Error('Managed E2E harness required');
    const origin = validateOrigin(baseURL);
    const contexts: APIRequestContext[] = [];
    const create = async () => {
      const owner = await newOwner(playwright, origin);
      contexts.push(owner);
      const account = credentials();
      const slug = `e2e-${randomUUID()}`;
      const name = `Empresa E2E ${slug
        .slice(4)
        .replaceAll('-', '')
        .replace(/(.{6})/g, '$1 ')
        .trim()}`;
      await responseData(
        await owner.post('/api/v1/auth/register-admin', {
          data: { ...account, tenantName: name },
        }),
        sessionSchema,
        201,
      );
      const tenant = new TenantFixture(owner, account, slug, name);
      await tenant.write(
        'PATCH',
        '/tenants/me',
        { publicSlug: slug, isPublicFormEnabled: true },
        tenantSchema,
      );
      return tenant;
    };
    try {
      await provide(create);
    } finally {
      await Promise.all(contexts.map((context) => context.dispose()));
    }
  },
  tenant: async ({ createPeer }, provide) => {
    await provide(await createPeer());
  },
});
test.afterEach(async ({ baseURL }, testInfo) => {
  void baseURL;
  // Keep every failure and its status; only rich diagnostic data is removed.
  redactErrors(testInfo.errors);
});
async function newOwner(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string,
) {
  return playwright.request.newContext({
    baseURL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Origin: baseURL, 'X-Auth-Mode': 'cookie' },
  });
}
export async function login(
  page: Page,
  account: ReturnType<typeof credentials>,
) {
  await page.goto('/admin/login');
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(account.password);
  await page
    .getByRole('button', { name: 'Iniciar Sesión', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page
      .getByRole('button', { name: 'Abrir menú del panel', exact: true })
      .or(
        page.getByRole('navigation', {
          name: 'Navegación del panel',
          exact: true,
        }),
      )
      .filter({ visible: true }),
  ).toBeVisible();
}
export async function browserCall(
  page: Page,
  input: {
    path: string;
    method?: string;
    data?: object;
    csrf?: boolean;
    forgeTenant?: string;
  },
) {
  return page.evaluate(
    async ({ path, method = 'GET', data, csrf = false, forgeTenant }) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Auth-Mode': 'cookie',
      };
      if (csrf) {
        const response = await fetch('/api/v1/auth/csrf', {
          credentials: 'include',
        });
        if (response.status !== 200) throw new Error('CSRF setup failed');
        const result = await response.json();
        if (
          typeof result?.data?.csrfToken !== 'string' ||
          !result.data.csrfToken
        )
          throw new Error('CSRF contract failed');
        headers['x-csrf-token'] = result.data.csrfToken;
      }
      if (forgeTenant) headers['X-Tenant-Id'] = forgeTenant;
      const response = await fetch(`/api/v1${path}`, {
        method,
        credentials: 'include',
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });
      return response.status;
    },
    input,
  );
}
export async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    'viewport overflow',
  ).toBe(true);
}
export { expect };
