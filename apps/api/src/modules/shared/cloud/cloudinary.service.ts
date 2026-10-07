import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { HttpResilienceService } from '../../webhooks';
import type { AppConfig } from '../../../config/app.config';
import { InternalError } from '../../../common/errors/application.error';

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
}
