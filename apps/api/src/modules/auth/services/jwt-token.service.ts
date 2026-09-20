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
    const appConfig = this.configService.get<AppConfig>('app');
    if (!appConfig) {
      throw new Error('JwtTokenService: app configuration not found — verificá que ConfigModule esté correctamente inicializado.');
    }
    this.jwtConfig = appConfig.jwt;
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
    if (!match) {
      throw new Error(
        `JwtTokenService: formato de duración inválido "${value}". Formato esperado: <número><m|h|d> (ej. "15m", "1h", "7d").`,
      );
    }

    const amount = Number(match[1]);
    const unit = match[2]!.toLowerCase();

    switch (unit) {
      case 'm': return amount * 60 * 1000;
      case 'h': return amount * 60 * 60 * 1000;
      default:  return amount * 24 * 60 * 60 * 1000; // 'd'
    }
  }
}
