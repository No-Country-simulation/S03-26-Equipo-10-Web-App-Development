import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { PasswordService } from '../../shared/hashing/password.service';
export interface TokenPayload {
  sub: string;
  email: string;
  tenantId: string;
  roles: string[];
}

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
  ) {}

  async signAccessToken(payload: TokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: this.parseDurationSeconds(process.env.JWT_ACCESS_EXPIRES_IN ?? '15m'),
    });
  }

  generateRefreshToken(): string {
    return randomBytes(48).toString('hex');
  }

  hashToken(token: string): string {
    return this.passwordService.hashOpaqueToken(token);
  }

  getRefreshExpiresAt(): Date {
    const ms = this.parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d');
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
