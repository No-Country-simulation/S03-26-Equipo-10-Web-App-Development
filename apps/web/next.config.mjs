import { fileURLToPath } from 'node:url';
import { normalizeApiBaseUrl, getBackendOrigin } from './config/api.mjs';

const apiBase = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
const apiOrigin = apiBase === '/api/v1' ? '' : new URL(apiBase).origin;
if (apiBase === '/api/v1') {
  getBackendOrigin(process.env.API_BACKEND_ORIGIN, process.env.NODE_ENV === 'production');
}

const isDevelopment = process.env.NODE_ENV !== 'production';
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://www.youtube.com${isDevelopment ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://res.cloudinary.com https://img.youtube.com https://i.ytimg.com",
  "font-src 'self' data:",
  `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ''}${isDevelopment ? ' ws: wss:' : ''}`,
  'frame-src https://www.youtube.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  // Image JSON reaches 14 MiB; middleware must not truncate the forwarded body.
  experimental: { middlewareClientMaxBodySize: '15mb', proxyTimeout: 30_000 },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
