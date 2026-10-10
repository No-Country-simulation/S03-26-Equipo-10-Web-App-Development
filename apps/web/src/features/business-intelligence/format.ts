export const number = (value: string | number) => typeof value === 'string' ? BigInt(value).toLocaleString('es-AR') : value.toLocaleString('es-AR');
export const rating = (value: number | null) => value === null ? 'Sin datos' : value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
export const percentage = (value: number | null) => value === null ? 'Sin datos' : `${rating(value)} %`;
export const timestamp = (value: string | null) => value ? `${new Date(value).toLocaleString('es-AR', { timeZone: 'UTC' })} UTC` : 'Sin datos';
export const statusNames: Record<string, string> = { draft: 'Borrador', pending: 'Pendiente', approved: 'Aprobado', published: 'Publicado',
  rejected: 'Rechazado', running: 'En ejecución', succeeded: 'Correcta', failed: 'Fallida', abandoned: 'Abandonada', cancelled: 'Cancelada', expired: 'Vencida', skipped: 'Omitida' };
export const originNames: Record<string, string> = { legacy: 'Legado (origen desconocido)', scheduled: 'Automática', cli: 'Operación técnica', manual: 'Manual', retry: 'Reintento manual' };
export const phaseName = (value: string | null) => value === 'extraction' ? 'Extracción' : value === 'publication' ? 'Publicación' : 'Sin fase registrada';
export const duration = (value: number | null) => value === null ? 'En curso o sin duración registrada' : `${rating(value / 1000)} s`;
