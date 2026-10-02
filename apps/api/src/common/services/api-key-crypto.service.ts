import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../../config/app.config';
import { UnavailableError } from '../errors/application.error';

export type ApiKeyScope = 'testimonials:read' | 'analytics:write';
export type ApiKeyEnvironment = 'live' | 'test';

export interface ParsedApiKey {
  environment: ApiKeyEnvironment;
  publicId: string;
  secret: string;
}

export interface IssuedApiKey extends ParsedApiKey {
  raw: string;
  digest: string;
  pepperVersion: number;
}

@Injectable()
export class ApiKeyCryptoService {
  constructor(private readonly config: ConfigService) {}

  private settings(): AppConfig['apiKeys'] {
    return this.config.getOrThrow<AppConfig>('app').apiKeys;
  }

  issue(): IssuedApiKey {
    const { environment, currentPepperVersion } = this.settings();
    const publicId = randomBytes(8).toString('hex');
    const secret = randomBytes(32).toString('hex');
    return {
      environment, publicId, secret,
      raw: `ak_${environment}_${publicId}_${secret}`,
      digest: this.digest(secret, currentPepperVersion),
      pepperVersion: currentPepperVersion,
    };
  }

  parse(raw: string): ParsedApiKey | null {
    if (raw.length !== 89) return null;
    const parts = raw.split('_');
    if (parts.length !== 4 || parts[0] !== 'ak') return null;
    const [, environment, publicId, secret] = parts;
    if (!environment || !publicId || !secret) return null;
    if (environment !== 'live' && environment !== 'test') return null;
    if (!/^[0-9a-f]{16}$/.test(publicId) || !/^[0-9a-f]{64}$/.test(secret)) return null;
    return { environment, publicId, secret };
  }

  isLegacy(raw: string): boolean {
    return raw.length === 52 && /^tms_[0-9a-f]{48}$/.test(raw);
  }

  legacyHash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  legacyAllowed(now = new Date()): boolean {
    const deadline = this.legacyDeadline();
    if (!deadline) return process.env.NODE_ENV !== 'production';
    return now < deadline;
  }

  legacyDeadline(): Date | null {
    const startedAt = this.settings().legacyStartedAt;
    return startedAt ? new Date(Date.parse(startedAt) + 30 * 24 * 60 * 60 * 1000) : null;
  }

  digest(secret: string, version: number): string {
    const encoded = this.settings().peppers[String(version)];
    if (!encoded) throw new UnavailableError('API key verifier unavailable');
    return createHmac('sha256', Buffer.from(encoded, 'base64url')).update(secret).digest('hex');
  }

  verify(secret: string, version: number, storedDigest: string): boolean {
    if (!/^[0-9a-f]{64}$/.test(storedDigest)) return false;
    const expected = Buffer.from(storedDigest, 'hex');
    const actual = Buffer.from(this.digest(secret, version), 'hex');
    return timingSafeEqual(actual, expected);
  }

  environment(): ApiKeyEnvironment {
    return this.settings().environment;
  }
}
