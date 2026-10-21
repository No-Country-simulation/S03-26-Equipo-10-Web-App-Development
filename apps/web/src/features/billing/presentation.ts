export function formatMoney(minor: string, currency: 'ARS' | 'USD') {
  const value = BigInt(minor);
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
  })
    .formatToParts(value / 100n)
    .map((p) =>
      p.type === 'fraction'
        ? (value % 100n).toString().padStart(2, '0')
        : p.value,
    )
    .join('');
}
export const billingDate = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value));
export const accessLabels = {
  unrestricted: 'Control comercial desactivado',
  trial: 'Prueba gratuita',
  paid: 'Período pago',
  grace: 'Período de gracia',
  read_only: 'Acceso de consulta',
} as const;
export function safeCheckoutUrl(
  value: string,
  runtime: string,
  origin: string,
) {
  const url = new URL(value);
  if (url.username || url.password)
    throw Error('Dirección de checkout no válida.');
  const hosted =
    url.protocol === 'https:' &&
    [
      'checkout.stripe.com',
      'www.mercadopago.com.ar',
      'sandbox.mercadopago.com.ar',
    ].includes(url.hostname);
  const simulated =
    runtime === 'simulation' &&
    url.origin === origin &&
    url.pathname === '/admin/billing/return';
  if (!hosted && !simulated)
    throw Error('Revisá la URL de retorno configurada para el proveedor.');
  return url.toString();
}
export function minorFromDecimal(value: string) {
  if (!/^(0|[1-9]\d{0,15})(\.\d{1,2})?$/.test(value))
    throw Error(
      'Usá un importe positivo con hasta dos decimales y punto decimal.',
    );
  const [whole, fraction = ''] = value.split('.');
  const minor = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (minor <= 0n) throw Error('El importe debe ser mayor que cero.');
  return minor.toString();
}

export const paymentLabels: Record<string, string> = {
  pending: 'Pendiente',
  failed: 'Rechazado',
  canceled: 'Cancelado',
  succeeded: 'Confirmado',
  partially_refunded: 'Devuelto parcialmente',
  refunded: 'Devuelto',
  charged_back: 'Contracargo confirmado',
};
export const operationLabels: Record<string, string> = {
  ready: 'Por procesar',
  processing: 'En proceso',
  succeeded: 'Completada',
  uncertain: 'Por confirmar',
  review: 'En revisión',
  completed: 'Procesada',
};
