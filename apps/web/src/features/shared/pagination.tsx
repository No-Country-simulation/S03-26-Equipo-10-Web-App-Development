'use client';

import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { ApiError, type ApiEnvelope } from '@/lib/api';
import {
  sessionRequest,
  type SessionFetch,
} from '@/lib/api/validated-response';

export const pageMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export async function sessionPageRequest<T extends z.ZodTypeAny>(
  fetchApi: SessionFetch,
  path: string,
  item: T,
): Promise<
  ApiEnvelope<{ items: z.infer<T>[]; meta: z.infer<typeof pageMetaSchema> }>
> {
  // ApiResponseInterceptor sends data[] and envelope.meta. Keep the HTTP
  // contract and adapt it explicitly for screens that consume {items, meta}.
  const response = await sessionRequest(fetchApi, path, z.array(item));
  const meta = pageMetaSchema.safeParse(response.meta);
  if (!meta.success || response.data.length > meta.data.limit)
    throw new ApiError(
      'El servidor devolvió una paginación inválida.',
      'INVALID_RESPONSE',
    );
  return { ...response, data: { items: response.data, meta: meta.data } };
}

export const pagePath = (path: string, page: number, limit = 20) =>
  `${path}?page=${page}&limit=${limit}`;

export function PageControls({
  page,
  total,
  limit,
  onChange,
}: {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <nav
      aria-label="Paginación"
      className="mt-4 flex items-center justify-end gap-3 text-sm"
    >
      <span>
        Página {page} de {pages} · {total} registros
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Anterior
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Siguiente
      </Button>
    </nav>
  );
}
