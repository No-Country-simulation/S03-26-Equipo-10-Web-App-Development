import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { HttpResilienceService } from '../../webhooks';
import type { AppConfig } from '../../../config/app.config';
import { InternalError, UnavailableError } from '../../../common/errors/application.error';

interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
}

const cloudinaryUploadSchema = z.object({
  secure_url: z.url().refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && url.pathname.length > 1;
  }),
  public_id: z.string().min(1),
});

@Injectable()
export class CloudinaryService {
  private readonly cloudinaryConfig: AppConfig['cloudinary'];

  constructor(
    private readonly http: HttpResilienceService,
    private readonly configService: ConfigService,
  ) {
    this.cloudinaryConfig = this.configService.get<AppConfig>('app')!.cloudinary;
    if (this.cloudinaryConfig.uploadUrl) {
      const url = new URL(this.cloudinaryConfig.uploadUrl);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
        throw new Error('CLOUDINARY_UPLOAD_URL must be HTTPS without credentials or query parameters');
      }
    }
  }

  async uploadImage(base64Data: string): Promise<CloudinaryUploadResult> {
    if (!this.cloudinaryConfig.uploadUrl) {
      if (process.env.NODE_ENV === 'production' || !this.cloudinaryConfig.localPlaceholder) {
        throw this.unavailable();
      }
      return {
        secureUrl: 'https://res.cloudinary.com/local-dev/image/upload/demo-placeholder.png',
        publicId: 'local-dev-placeholder',
      };
    }

    const payload = {
      file: base64Data,
      upload_preset: this.cloudinaryConfig.uploadPreset,
    };

    const response = await this.http.request<unknown>(
      this.cloudinaryConfig.uploadUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      { circuitKey: 'cloudinary', timeoutMs: 5000, retries: 0 },
    );

    const parsed = cloudinaryUploadSchema.safeParse(response);
    if (!parsed.success) throw new InternalError('Invalid Cloudinary upload response');

    return {
      secureUrl: parsed.data.secure_url,
      publicId: parsed.data.public_id,
    };
  }

  assertLogoStorage(): void {
    const { cloudName, apiKey, apiSecret } = this.cloudinaryConfig;
    if (!cloudName || !/^[a-zA-Z0-9_-]+$/.test(cloudName) || !apiKey?.trim() || !apiSecret?.trim()) {
      throw this.unavailable();
    }
  }

  async uploadLogo(base64Data: string, publicId: string): Promise<CloudinaryUploadResult> {
    this.assertLogoStorage();
    this.assertLogoId(publicId);
    const body = this.signedBody({
      overwrite: 'false', public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)),
    });
    body.set('file', base64Data);
    try {
      const response = await this.http.request<unknown>(this.logoEndpoint('upload'), {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(),
      }, { circuitKey: 'cloudinary-logo', timeoutMs: 5000, retries: 0 });
      const parsed = cloudinaryUploadSchema.extend({
        resource_type: z.literal('image'), format: z.enum(['png', 'jpg', 'jpeg', 'webp']),
      }).safeParse(response);
      if (!parsed.success || parsed.data.public_id !== publicId) throw this.unavailable();
      const url = new URL(parsed.data.secure_url);
      if (url.username || url.password || url.port || url.search || url.hash
        || !url.pathname.startsWith(`/${this.cloudinaryConfig.cloudName}/image/upload/`)) throw this.unavailable();
      return { secureUrl: parsed.data.secure_url, publicId: parsed.data.public_id };
    } catch {
      throw this.unavailable();
    }
  }

  async destroyLogo(publicId: string): Promise<void> {
    this.assertLogoStorage();
    this.assertLogoId(publicId);
    const body = this.signedBody({
      invalidate: 'true', public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)),
    });
    try {
      const response = await this.http.request<unknown>(this.logoEndpoint('destroy'), {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(),
      }, { circuitKey: 'cloudinary-logo', timeoutMs: 5000, retries: 0 });
      if (!z.object({ result: z.enum(['ok', 'not found']) }).safeParse(response).success) throw this.unavailable();
    } catch {
      throw this.unavailable();
    }
  }

  private signedBody(parameters: Record<string, string>): URLSearchParams {
    const canonical = Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`).join('&');
    const signature = createHash('sha256').update(canonical + this.cloudinaryConfig.apiSecret!).digest('hex');
    return new URLSearchParams({ ...parameters, signature, api_key: this.cloudinaryConfig.apiKey! });
  }

  private logoEndpoint(action: 'upload' | 'destroy'): string {
    return `https://api.cloudinary.com/v1_1/${this.cloudinaryConfig.cloudName}/image/${action}`;
  }

  private assertLogoId(publicId: string): void {
    if (!/^tenant-logos\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(publicId)) throw this.unavailable();
  }

  private unavailable(): UnavailableError {
    return new UnavailableError('Image storage is unavailable', 'MEDIA_STORAGE_UNAVAILABLE');
  }
}
