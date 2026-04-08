import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { PasswordService } from '../../shared/hashing/password.service';
import type { AppConfig } from '../../../config/app.config';

export interface TokenPayload {
  sub: string;
  email: string;
  tenantId: string;
  roles: string[];
}

@Injectable()
export class JwtTokenService {
  private readonly jwtConfig: AppConfig['jwt'];

  constructor(
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly configService: ConfigService,
  ) {
    this.jwtConfig = this.configService.get<AppConfig>('app')!.jwt;
  }

  async signAccessToken(payload: TokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.jwtConfig.secret,
      expiresIn: this.parseDurationSeconds(this.jwtConfig.accessExpiresIn),
    });
  }

  generateRefreshToken(): string {
    return randomBytes(48).toString('hex');
  }

  hashToken(token: string): string {
    return this.passwordService.hashOpaqueToken(token);
  }

  getRefreshExpiresAt(): Date {
    const ms = this.parseDurationMs(this.jwtConfig.refreshExpiresIn);
    return new Date(Date.now() + ms);
  }

  private parseDurationSeconds(value: string): number {
    return Math.floor(this.parseDurationMs(value) / 1000);
  }

  private parseDurationMs(value: string): number {
    const match = value.match(/^(\d+)([mhd])$/i);
    if (!match) return 7 * 24 * 60 * 60 * 1000;

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'm': return amount * 60 * 1000;
      case 'h': return amount * 60 * 60 * 1000;
      case 'd':
      default: return amount * 24 * 60 * 60 * 1000;
    }
  }
}
