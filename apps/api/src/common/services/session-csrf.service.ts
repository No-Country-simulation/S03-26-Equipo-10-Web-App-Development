import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../../config/app.config';

@Injectable()
export class SessionCsrfService {
  constructor(private readonly config: ConfigService) {}

  tokenFor(refreshToken: string): string {
    const secret = this.config.getOrThrow<AppConfig>('app').jwt.secret;
    return createHmac('sha256', secret)
      .update('testimonial-cms:csrf:v1\0')
      .update(refreshToken)
      .digest('base64url');
  }

  verify(refreshToken: string, supplied: string | undefined): boolean {
    if (!supplied || !/^[A-Za-z0-9_-]{43}$/.test(supplied)) return false;
    const actual = Buffer.from(supplied);
    const expected = Buffer.from(this.tokenFor(refreshToken));
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }
}
