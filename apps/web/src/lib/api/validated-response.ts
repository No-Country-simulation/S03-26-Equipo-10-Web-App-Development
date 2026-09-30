import { z } from 'zod';
import { ApiEnvelope, ApiError, requestApi } from '@/lib/api';

export type SessionFetch = <T>(path: string, init?: RequestInit) => Promise<ApiEnvelope<T>>;

function validate<T extends z.ZodTypeAny>(
  response: ApiEnvelope<unknown>,
  schema: T,
): ApiEnvelope<z.infer<T>> {
  if (response.success !== true) {
    throw new ApiError('El servidor devolvió una respuesta inesperada.', 'INVALID_RESPONSE');
  }
  const parsed = schema.safeParse(response.data);
  if (!parsed.success) {
    throw new ApiError('El servidor devolvió una respuesta inesperada.', 'INVALID_RESPONSE');
  }
  return { ...response, data: parsed.data };
}

export async function sessionRequest<T extends z.ZodTypeAny>(
  fetchApi: SessionFetch,
  path: string,
  schema: T,
  init?: RequestInit,
): Promise<ApiEnvelope<z.infer<T>>> {
  return validate(await fetchApi<unknown>(path, init), schema);
}

export async function publicRequest<T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  init?: RequestInit,
): Promise<ApiEnvelope<z.infer<T>>> {
  return validate(await requestApi<unknown>(path, init), schema);
}

export const deletedSchema = z.object({ id: z.string(), deleted: z.boolean() }).passthrough();
