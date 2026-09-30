import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export interface AppConfig {
  port: number;
  corsOrigin: string;
  trustedProxyHops: number;
  jwt: {
    secret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  database: {
    url: string;
  };
  cloudinary: {
    uploadUrl: string;
    uploadPreset: string;
  };
  youtube: {
    apiKey: string;
  };
}

export const appConfigValidationSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(process.env.NODE_ENV === 'production' ? 1 : 0),
  CORS_ORIGIN: z.string().url().refine((value) => {
    if (!URL.canParse(value)) return false;
    const origin = new URL(value);
    return ['http:', 'https:'].includes(origin.protocol)
      && !origin.username
      && !origin.password
      && origin.pathname === '/'
      && !origin.search
      && !origin.hash;
  }, 'CORS_ORIGIN must be an HTTP(S) origin').default('http://localhost:3000'),

  JWT_SECRET: z.string({
    message: 'JWT_SECRET is required — the application cannot start without it',
  }).refine((value) => value.trim().length >= 32, 'JWT_SECRET must contain at least 32 characters after trimming'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  DATABASE_URL: z.string({
    message: 'DATABASE_URL is required — the application cannot start without it',
  }).url().refine(
    (value) => URL.canParse(value) && ['postgresql:', 'postgres:'].includes(new URL(value).protocol),
    'DATABASE_URL must be a PostgreSQL URL',
  ),

  CLOUDINARY_UPLOAD_URL: z.string().default(''),
  CLOUDINARY_UPLOAD_PRESET: z.string().default(''),

  YOUTUBE_API_KEY: z.string().default(''),
});

export const appConfig = registerAs('app', (): AppConfig => ({
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  trustedProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? (process.env.NODE_ENV === 'production' ? 1 : 0)),
  jwt: {
    secret: process.env.JWT_SECRET!,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  cloudinary: {
    uploadUrl: process.env.CLOUDINARY_UPLOAD_URL ?? '',
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET ?? '',
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY ?? '',
  },
}));
