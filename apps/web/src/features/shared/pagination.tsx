'use client';

import { z } from 'zod';
import { Button } from '@/components/ui/button';

export const pageMetaSchema = z.object({ total: z.number(), page: z.number(), limit: z.number() });
export const paginatedSchema = <T extends z.ZodTypeAny>(item: T) => z.object({
  items: z.array(item), meta: pageMetaSchema,
});

export const pagePath = (path: string, page: number, limit = 20) =>
  `${path}?page=${page}&limit=${limit}`;

export function PageControls({ page, total, limit, onChange }: {
  page: number; total: number; limit: number; onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-end gap-3 text-sm">
      <span>Página {page} de {pages} · {total} registros</span>
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Siguiente</Button>
    </nav>
  );
}
