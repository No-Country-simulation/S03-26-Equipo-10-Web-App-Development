import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpResilienceService } from '../../webhooks/services/http-resilience.service';
import type { AppConfig } from '../../../config/app.config';

interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
}

@Injectable()
export class CloudinaryService {
  private readonly cloudinaryConfig: AppConfig['cloudinary'];

  constructor(
    private readonly http: HttpResilienceService,
    private readonly configService: ConfigService,
  ) {
    this.cloudinaryConfig = this.configService.get<AppConfig>('app')!.cloudinary;
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

    const response = await this.http.request<{ secure_url: string; public_id: string }>(
      this.cloudinaryConfig.uploadUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      { circuitKey: 'cloudinary', timeoutMs: 5000, retries: 2 },
    );

    return {
      secureUrl: response.secure_url,
      publicId: response.public_id,
    };
  }
}
