/** datetime-local takes wall time, never a UTC substring. */
export function localExpiry(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function expiryChange(
  value: string,
  original: string | null,
): string | undefined {
  // Omission preserves the server's exact instant, including seconds/milliseconds.
  if (value === localExpiry(original)) return undefined;
  if (!value && original)
    throw new Error(
      'La rotación no permite quitar el vencimiento. Conservá la fecha o elegí otra futura.',
    );
  if (!value) return undefined;
  const date = new Date(value);
  if (
    !Number.isFinite(date.getTime()) ||
    localExpiry(date.toISOString()) !== value
  )
    throw new Error(
      'Revisá el vencimiento: esa fecha u hora no existe en tu zona horaria.',
    );
  if (date.getTime() <= Date.now())
    throw new Error('Elegí un vencimiento futuro.');
  return date.toISOString();
}

export const scopeLabels = {
  'testimonials:read': 'Leer testimonios publicados',
  'analytics:write': 'Registrar vistas y clics',
} as const;
