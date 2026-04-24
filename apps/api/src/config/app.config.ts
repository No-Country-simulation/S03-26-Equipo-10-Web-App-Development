import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export interface AppConfig {
  port: number;
  corsOrigin: string;
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
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  JWT_SECRET: z.string({
    required_error: 'JWT_SECRET is required — the application cannot start without it',
  }),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  DATABASE_URL: z.string({
    required_error: 'DATABASE_URL is required — the application cannot start without it',
  }),

  CLOUDINARY_UPLOAD_URL: z.string().default(''),
  CLOUDINARY_UPLOAD_PRESET: z.string().default(''),

  YOUTUBE_API_KEY: z.string().default(''),
});

export const appConfig = registerAs('app', (): AppConfig => ({
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
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
