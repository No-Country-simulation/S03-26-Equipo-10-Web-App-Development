import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, IAuthRepository } from '../../core/repositories/auth.repository';
import { TOKEN_SERVICE, ITokenService } from '../ports/token.port';

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepo: IAuthRepository,
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
  ) {}

  async execute(refreshToken: string) {
    const tokenHash = this.tokenService.hashToken(refreshToken);
    const record = await this.authRepo.findValidRefreshToken(tokenHash);
    if (!record) throw new UnauthorizedException('Invalid or expired refresh token');

    const user = record.user;
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');
    if (!user.tenantIsActive) throw new UnauthorizedException('Tenant is disabled');

    // Rotate: revoke old, create new
    await this.authRepo.revokeRefreshToken(record.id);

    const newRefreshToken = this.tokenService.generateRefreshToken();
    await this.authRepo.createRefreshToken(
      user.id,
      this.tokenService.hashToken(newRefreshToken),
      this.tokenService.getRefreshExpiresAt(),
    );

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        tenantName: user.tenantName,
        roles: user.roles,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      tokens: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    };
  }
}
