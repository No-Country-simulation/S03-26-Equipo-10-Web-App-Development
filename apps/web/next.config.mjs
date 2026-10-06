import { z } from "zod";

const { NEXT_PUBLIC_API_URL } = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  }, 'NEXT_PUBLIC_API_URL must be an HTTP(S) URL without credentials'),
}).parse({ NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL });

const apiOrigin = new URL(NEXT_PUBLIC_API_URL).origin;
const isDevelopment = process.env.NODE_ENV !== 'production';
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://www.youtube.com${isDevelopment ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://res.cloudinary.com https://img.youtube.com https://i.ytimg.com",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin}${isDevelopment ? ' ws: wss:' : ''}`,
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
