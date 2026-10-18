import type { WebhookView } from './api';
export const eventLabels: Record<string, string> = {
  'testimonial.created': 'Testimonio creado',
  'testimonial.published': 'Testimonio publicado',
};
export const eventLabel = (code: string) => eventLabels[code] ?? code;
export const dateLabel = (date: string) =>
  new Date(date).toLocaleString('es-AR', { timeZoneName: 'short' });
export const deliveryLabels: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'En proceso',
  success: 'Entregada',
  dead: 'Sin entrega',
};
export const attemptLabels: Record<string, string> = {
  processing: 'En proceso',
  success: 'Correcto',
  failed: 'Fallido',
  interrupted: 'Interrumpido',
};
export function blockedDelivery(webhook: WebhookView) {
  return (
    webhook.legacyHttp?.canDeliver === false ||
    webhook.legacyUnsigned?.canDeliver === false
  );
}
