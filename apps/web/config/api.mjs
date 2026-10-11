/** Public build setting: the browser may use this value. */
export function normalizeApiBaseUrl(value) {
  if (value === '/api/v1') return value;
  if (!value || !URL.canParse(value)) throw new Error('NEXT_PUBLIC_API_URL must be /api/v1 or an HTTP(S) URL');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('NEXT_PUBLIC_API_URL must be an HTTP(S) URL without credentials, query or fragment');
  }
  const base = value.replace(/\/$/, '');
  return base.endsWith('/api') ? `${base}/v1` : base;
}

/** Server-only setting; never derive the destination from request headers. */
export function getBackendOrigin(value, production = false) {
  if (!value || !URL.canParse(value)) throw new Error('API_BACKEND_ORIGIN is required for the API proxy');
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || (production && url.protocol !== 'https:' && !local)) {
    throw new Error('API_BACKEND_ORIGIN must be an HTTP(S) origin without credentials (HTTPS outside local development)');
  }
  return url.origin;
}
