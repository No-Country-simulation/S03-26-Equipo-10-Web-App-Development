import { z } from 'zod';
import { publicRequest } from '@/lib/api/validated-response';

const sessionSchema = z.object({
  user: z.object({
    id: z.string(), email: z.string(), tenantId: z.string(), tenantName: z.string(),
    roles: z.array(z.string()), isActive: z.boolean(), createdAt: z.string(),
  }),
  tokens: z.object({ accessToken: z.string(), refreshToken: z.string() }),
});

export async function login(input: { email: string; password: string }) {
  return (await publicRequest('/auth/login', sessionSchema, {
    method: 'POST', body: JSON.stringify(input),
  })).data;
}

export async function registerAdmin(input: { tenantName: string; email: string; password: string }) {
  return (await publicRequest('/auth/register-admin', sessionSchema, {
    method: 'POST', body: JSON.stringify(input),
  })).data;
}
