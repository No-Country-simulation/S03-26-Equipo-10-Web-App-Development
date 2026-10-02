import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { AppConfig } from '../../../config/app.config';
import { UnavailableError } from '../../../common/errors/application.error';

export interface EncryptedWebhookSecret {
  ciphertext: string;
  keyVersion: number;
}

const LEGACY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class WebhookSecretService {
  constructor(private readonly config: ConfigService) {}

  private settings(): AppConfig {
    return this.config.getOrThrow<AppConfig>('app');
  }

  issue(): string {
    return `whsec_${randomBytes(32).toString('hex')}`;
  }

  encrypt(tenantId: string, webhookId: string, secret: string): EncryptedWebhookSecret {
    const { currentKeyVersion, keys } = this.settings().webhookSecrets;
    const key = this.key(keys[String(currentKeyVersion)]);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(this.aad(tenantId, webhookId));
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return {
      ciphertext: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url'),
      keyVersion: currentKeyVersion,
    };
  }

  decrypt(tenantId: string, webhookId: string, encrypted: EncryptedWebhookSecret): string {
    const key = this.key(this.settings().webhookSecrets.keys[String(encrypted.keyVersion)]);
    const bytes = Buffer.from(encrypted.ciphertext, 'base64url');
    if (bytes.length < 29 || bytes.toString('base64url') !== encrypted.ciphertext) {
      throw new UnavailableError('Webhook secret unavailable');
    }
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      decipher.setAAD(this.aad(tenantId, webhookId));
      decipher.setAuthTag(bytes.subarray(12, 28));
      return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
    } catch {
      throw new UnavailableError('Webhook secret unavailable');
    }
  }

  legacyDeadline(createdAt: Date): Date | null {
    const started = this.legacyStartedAt()?.getTime();
    if (started === undefined) return null;
    return createdAt.getTime() <= started ? new Date(started + LEGACY_WINDOW_MS) : null;
  }

  legacyStartedAt(): Date | null {
    const value = this.settings().webhookSignatureLegacyStartedAt;
    return value ? new Date(value) : null;
  }

  legacyAllowed(createdAt: Date, now = Date.now()): boolean {
    const deadline = this.legacyDeadline(createdAt);
    return !!deadline && now < deadline.getTime();
  }

  private key(encoded: string | undefined): Buffer {
    if (!encoded) throw new UnavailableError('Webhook encryption key unavailable');
    const key = Buffer.from(encoded, 'base64url');
    if (key.length !== 32) throw new UnavailableError('Webhook encryption key unavailable');
    return key;
  }

  private aad(tenantId: string, webhookId: string): Buffer {
    return Buffer.from(`tms:webhook:v1:${tenantId}:${webhookId}`);
  }
}
