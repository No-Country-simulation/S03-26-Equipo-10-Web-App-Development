import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export interface AppConfig {
  metricsToken: string;
  port: number;
  corsOrigin: string;
  trustedProxyHops: number;
  webhookLegacyHttpStartedAt: string | null;
  webhookSignatureLegacyStartedAt: string | null;
  webhookSecrets: {
    currentKeyVersion: number;
    keys: Record<string, string>;
  };
  authLegacyStartedAt: string | null;
  apiKeys: {
    environment: 'live' | 'test';
    currentPepperVersion: number;
    peppers: Record<string, string>;
    legacyStartedAt: string | null;
  };
  jwt: {
    secret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  database: {
    url: string;
  };
  redis: { url: string };
  cloudinary: {
    uploadUrl: string;
    uploadPreset: string;
    cloudName?: string;
    apiKey?: string;
    apiSecret?: string;
    localPlaceholder?: boolean;
  };
  youtube: {
    apiKey: string;
  };
}

export const appConfigValidationSchema = z.object({
  METRICS_TOKEN: z.string().default(''),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(process.env.NODE_ENV === 'production' ? 1 : 0),
  WEBHOOK_LEGACY_HTTP_STARTED_AT: z.union([
    z.literal(''),
    z.iso.datetime({ offset: false, local: false })
      .refine(value => !Number.isNaN(Date.parse(value))),
  ]).default(''),
  WEBHOOK_SIGNATURE_LEGACY_STARTED_AT: z.union([
    z.literal(''),
    z.iso.datetime({ offset: false, local: false })
      .refine(value => !Number.isNaN(Date.parse(value))),
  ]).default(''),
  WEBHOOK_SECRET_CURRENT_VERSION: z.coerce.number().int().positive().default(1),
  WEBHOOK_SECRET_KEYS_JSON: z.string().default('').refine(value => {
    if (!value) return process.env.NODE_ENV !== 'production';
    try {
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
      return Object.entries(parsed).length > 0 && Object.entries(parsed).every(([version, key]) => {
        if (!/^[1-9]\d*$/.test(version) || typeof key !== 'string') return false;
        const bytes = Buffer.from(key, 'base64url');
        return bytes.length === 32 && bytes.toString('base64url') === key;
      });
    } catch { return false; }
  }, 'WEBHOOK_SECRET_KEYS_JSON must map versions to 32-byte base64url keys'),
  AUTH_LEGACY_STARTED_AT: z.union([
    z.literal(''),
    z.iso.datetime({ offset: false, local: false })
      .refine(value => !Number.isNaN(Date.parse(value))),
  ]).default(''),
  API_KEY_LEGACY_STARTED_AT: z.union([
    z.literal(''),
    z.iso.datetime({ offset: false, local: false })
      .refine(value => !Number.isNaN(Date.parse(value))),
  ]).default(''),
  API_KEY_PEPPER_CURRENT_VERSION: z.coerce.number().int().positive().default(1),
  API_KEY_PEPPERS_JSON: z.string().default('').refine(value => {
    if (!value) return process.env.NODE_ENV !== 'production';
    try {
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
      return Object.entries(parsed).length > 0 && Object.entries(parsed).every(([version, pepper]) => {
        if (!/^[1-9]\d*$/.test(version) || typeof pepper !== 'string') return false;
        const bytes = Buffer.from(pepper, 'base64url');
        return bytes.length >= 32 && bytes.toString('base64url') === pepper;
      });
    } catch { return false; }
  }, 'API_KEY_PEPPERS_JSON must map positive versions to base64url secrets of at least 32 bytes'),
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

  REDIS_URL: z.url().refine(value => ['redis:', 'rediss:'].includes(new URL(value).protocol),
    'REDIS_URL must be a Redis URL').default('redis://127.0.0.1:6379'),

  CLOUDINARY_UPLOAD_URL: z.string().default(''),
  CLOUDINARY_UPLOAD_PRESET: z.string().default(''),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  CLOUDINARY_LOCAL_PLACEHOLDER: z.enum(['true', 'false']).default('false'),

  YOUTUBE_API_KEY: z.string().default(''),
}).superRefine((env, context) => {
  if (env.API_KEY_PEPPERS_JSON) {
    let peppers: Record<string, string> = {};
    try { peppers = JSON.parse(env.API_KEY_PEPPERS_JSON) as Record<string, string>; } catch { return; }
    if (!peppers[String(env.API_KEY_PEPPER_CURRENT_VERSION)]) {
      context.addIssue({ code: 'custom', path: ['API_KEY_PEPPER_CURRENT_VERSION'],
        message: 'Current API key pepper version is missing' });
    }
  }
  if (env.WEBHOOK_SECRET_KEYS_JSON) {
    let keys: Record<string, string> = {};
    try { keys = JSON.parse(env.WEBHOOK_SECRET_KEYS_JSON) as Record<string, string>; } catch { return; }
    if (!keys[String(env.WEBHOOK_SECRET_CURRENT_VERSION)]) {
      context.addIssue({ code: 'custom', path: ['WEBHOOK_SECRET_CURRENT_VERSION'],
        message: 'Current webhook encryption key version is missing' });
    }
  }
});

export const appConfig = registerAs('app', (): AppConfig => {
  if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
    throw new Error('REDIS_URL is required in production');
  }
  if (process.env.NODE_ENV === 'production' && !process.env.API_KEY_PEPPERS_JSON) {
    throw new Error('API_KEY_PEPPERS_JSON is required in production');
  }
  if (process.env.NODE_ENV === 'production' && !process.env.WEBHOOK_SECRET_KEYS_JSON) {
    throw new Error('WEBHOOK_SECRET_KEYS_JSON is required in production');
  }
  return {
    metricsToken: process.env.METRICS_TOKEN ?? '',
    port: Number(process.env.PORT ?? 4000),
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    trustedProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? (process.env.NODE_ENV === 'production' ? 1 : 0)),
    webhookLegacyHttpStartedAt: process.env.WEBHOOK_LEGACY_HTTP_STARTED_AT || null,
    webhookSignatureLegacyStartedAt: process.env.WEBHOOK_SIGNATURE_LEGACY_STARTED_AT || null,
    webhookSecrets: {
      currentKeyVersion: Number(process.env.WEBHOOK_SECRET_CURRENT_VERSION ?? 1),
      keys: process.env.WEBHOOK_SECRET_KEYS_JSON
        ? JSON.parse(process.env.WEBHOOK_SECRET_KEYS_JSON) as Record<string, string> : {},
    },
    authLegacyStartedAt: process.env.AUTH_LEGACY_STARTED_AT || null,
    apiKeys: {
      environment: process.env.NODE_ENV === 'production' ? 'live' : 'test',
      currentPepperVersion: Number(process.env.API_KEY_PEPPER_CURRENT_VERSION ?? 1),
      peppers: process.env.API_KEY_PEPPERS_JSON
        ? JSON.parse(process.env.API_KEY_PEPPERS_JSON) as Record<string, string> : {},
      legacyStartedAt: process.env.API_KEY_LEGACY_STARTED_AT || null,
    },
    jwt: {
      secret: process.env.JWT_SECRET!,
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    },
    database: { url: process.env.DATABASE_URL! },
    redis: { url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379' },
    cloudinary: {
      uploadUrl: process.env.CLOUDINARY_UPLOAD_URL ?? '',
      uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET ?? '',
      cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
      apiKey: process.env.CLOUDINARY_API_KEY ?? '',
      apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
      localPlaceholder: process.env.NODE_ENV !== 'production' && process.env.CLOUDINARY_LOCAL_PLACEHOLDER === 'true',
    },
    youtube: { apiKey: process.env.YOUTUBE_API_KEY ?? '' },
  };
});
