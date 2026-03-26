import { Injectable } from '@nestjs/common';
import { HttpResilienceService } from '../http-resilience/http-resilience.service';

interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
}

@Injectable()
export class CloudinaryAdapter {
  constructor(private readonly http: HttpResilienceService) {}

  async uploadImage(base64Data: string): Promise<CloudinaryUploadResult> {
    if (!process.env.CLOUDINARY_UPLOAD_URL) {
      return {
        secureUrl: 'https://res.cloudinary.com/local-dev/image/upload/demo-placeholder.png',
        publicId: 'local-dev-placeholder',
      };
    }

    const payload = {
      file: base64Data,
      upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
    };

    const response = await this.http.request<{ secure_url: string; public_id: string }>(
      process.env.CLOUDINARY_UPLOAD_URL,
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
