import { z } from 'zod';
import {
  sessionRequest,
  type SessionFetch,
} from '@/lib/api/validated-response';

const tenantSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    publicSlug: z.string().nullable(),
    isPublicFormEnabled: z.boolean(),
    isActive: z.boolean(),
    createdAt: z.string(),
    logoUrl: z.string().url().nullable(),
  })
  .passthrough();
const flagSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    enabled: z.boolean(),
    description: z.string().nullable().optional(),
  })
  .passthrough();
export type TenantInfo = z.infer<typeof tenantSchema>;
export type FeatureFlag = z.infer<typeof flagSchema>;

export const getTenant = (fetchApi: SessionFetch) =>
  sessionRequest(fetchApi, '/tenants/me', tenantSchema);
export const listFeatureFlags = (fetchApi: SessionFetch) =>
  sessionRequest(fetchApi, '/feature-flags', z.array(flagSchema));
export type UpdateTenantInput = {
  name?: string;
  publicSlug?: string;
  isPublicFormEnabled?: boolean;
};
export const updateTenant = (
  fetchApi: SessionFetch,
  input: UpdateTenantInput,
  tenantId?: string,
) =>
  sessionRequest(
    fetchApi,
    '/tenants/me',
    tenantSchema.refine(
      (value) =>
        (!tenantId || value.id === tenantId) &&
        Object.entries(input).every(
          ([key, expected]) => value[key] === expected,
        ),
    ),
    { method: 'PATCH', body: JSON.stringify(input) },
  );

export const uploadTenantLogo = (fetchApi: SessionFetch, imageBase64: string) =>
  sessionRequest(fetchApi, '/tenants/me/logo', tenantSchema, {
    method: 'PUT',
    body: JSON.stringify({ imageBase64 }),
  });
export const removeTenantLogo = (fetchApi: SessionFetch) =>
  sessionRequest(fetchApi, '/tenants/me/logo', tenantSchema, {
    method: 'DELETE',
  });

export const updateFeatureFlag = (
  fetchApi: SessionFetch,
  name: string,
  enabled: boolean,
  tenantId: string,
) =>
  sessionRequest(
    fetchApi,
    `/feature-flags/${encodeURIComponent(name)}`,
    z.object({
      flagName: z.literal(name),
      enabled: z.literal(enabled),
      tenantId: z.literal(tenantId),
      updatedAt: z.string().datetime(),
    }),
    { method: 'PATCH', body: JSON.stringify({ enabled }) },
  );
