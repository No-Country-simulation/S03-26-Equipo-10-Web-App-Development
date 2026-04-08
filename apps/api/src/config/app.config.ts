import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

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

export const appConfigValidationSchema = Joi.object({
  PORT: Joi.number().default(4000),
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),

  JWT_SECRET: Joi.string().required().messages({
    'any.required': 'JWT_SECRET is required — the application cannot start without it',
  }),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  DATABASE_URL: Joi.string().required().messages({
    'any.required': 'DATABASE_URL is required — the application cannot start without it',
  }),

  CLOUDINARY_UPLOAD_URL: Joi.string().default(''),
  CLOUDINARY_UPLOAD_PRESET: Joi.string().default(''),

  YOUTUBE_API_KEY: Joi.string().default(''),
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
