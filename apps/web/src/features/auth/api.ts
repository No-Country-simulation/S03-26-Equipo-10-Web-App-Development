import { z } from 'zod';
import { publicRequest } from '@/lib/api/validated-response';
import { ApiError, requestApi } from '@/lib/api';

const sessionSchema = z.object({
  user: z.object({
    id: z.string(), email: z.string(), tenantId: z.string(), tenantName: z.string(),
    roles: z.array(z.string()), isActive: z.boolean(), createdAt: z.string().optional(),
  }),
});

let csrfToken: string | null = null;
let refreshPromise: Promise<void> | null = null;
let recoveryPromise: Promise<z.infer<typeof sessionSchema>> | null = null;
let sessionGeneration = 0;

export function clearSessionMemory() { csrfToken = null; sessionGeneration += 1; }

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await publicRequest('/auth/csrf', z.object({ csrfToken: z.string() }));
  csrfToken = response.data.csrfToken;
  return csrfToken;
}

async function refreshCookies(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const token = await getCsrfToken();
      await publicRequest('/auth/refresh', sessionSchema, {
        method: 'POST', headers: { 'X-Auth-Mode': 'cookie', 'x-csrf-token': token }, body: '{}',
      });
      csrfToken = null;
      sessionGeneration += 1;
    })().finally(() => { refreshPromise = null; });
  }
  await refreshPromise;
}

export async function authenticatedRequest<T>(path: string, init: RequestInit = {}) {
  const mutable = !!init.method && !['GET', 'HEAD', 'OPTIONS'].includes(init.method.toUpperCase());
  const headers = new Headers(init.headers);
  if (mutable) headers.set('x-csrf-token', await getCsrfToken());
  const generation = sessionGeneration;
  try {
    return await requestApi<T>(path, { ...init, headers });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    if (generation === sessionGeneration) await refreshCookies();
    if (mutable) headers.set('x-csrf-token', await getCsrfToken());
    return requestApi<T>(path, { ...init, headers });
  }
}

async function recoverSessionOnce() {
  const { takeLegacyRefreshToken } = await import('@/lib/session-store');
  const legacyToken = takeLegacyRefreshToken();
  if (legacyToken) {
    try {
      const upgraded = await publicRequest('/auth/upgrade-session', sessionSchema, {
        method: 'POST', headers: { 'X-Auth-Mode': 'cookie' },
        body: JSON.stringify({ refreshToken: legacyToken }),
      });
      clearSessionMemory();
      return upgraded.data;
    } catch { /* A consumed or expired legacy token falls through to cookie recovery. */ }
  }
  const response = await authenticatedRequest<{ user: z.infer<typeof sessionSchema>['user'] }>('/auth/me');
  return sessionSchema.parse({ user: response.data.user });
}

export function recoverSession() {
  if (!recoveryPromise) {
    recoveryPromise = recoverSessionOnce().finally(() => { recoveryPromise = null; });
  }
  return recoveryPromise;
}

export async function logout() {
  try {
    const token = await getCsrfToken();
    await publicRequest('/auth/logout', z.object({ message: z.string() }), {
      method: 'POST', headers: { 'X-Auth-Mode': 'cookie', 'x-csrf-token': token }, body: '{}',
    });
  } finally {
    clearSessionMemory();
  }
}

export async function login(input: { email: string; password: string }) {
  const result = (await publicRequest('/auth/login', sessionSchema, {
    method: 'POST', headers: { 'X-Auth-Mode': 'cookie' }, body: JSON.stringify(input),
  })).data;
  clearSessionMemory();
  return result;
}

export async function registerAdmin(input: { tenantName: string; email: string; password: string }) {
  const result = (await publicRequest('/auth/register-admin', sessionSchema, {
    method: 'POST', headers: { 'X-Auth-Mode': 'cookie' }, body: JSON.stringify(input),
  })).data;
  clearSessionMemory();
  return result;
}
