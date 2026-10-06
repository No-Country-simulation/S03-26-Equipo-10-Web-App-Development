import { z } from 'zod';
import { sessionRequest, type SessionFetch } from '@/lib/api/validated-response';

const tenantSchema = z.object({
  id: z.string(), name: z.string(), publicSlug: z.string().nullable(),
  isPublicFormEnabled: z.boolean(), isActive: z.boolean(), createdAt: z.string(),
}).passthrough();
const flagSchema = z.object({ id: z.string(), name: z.string(), enabled: z.boolean().optional() }).passthrough();

export const getTenant = (fetchApi: SessionFetch) => sessionRequest(fetchApi, '/tenants/me', tenantSchema);
export const listFeatureFlags = (fetchApi: SessionFetch) => sessionRequest(fetchApi, '/feature-flags', z.array(flagSchema));
export type UpdateTenantInput = { name?: string; publicSlug?: string; isPublicFormEnabled?: boolean };
export const updateTenant = (fetchApi: SessionFetch, input: UpdateTenantInput) =>
  sessionRequest(fetchApi, '/tenants/me', tenantSchema, { method: 'PATCH', body: JSON.stringify(input) });
