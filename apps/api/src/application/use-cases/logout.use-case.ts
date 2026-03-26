import { Inject, Injectable } from '@nestjs/common';
import { AUTH_REPOSITORY, IAuthRepository } from '../../core/repositories/auth.repository';
import { TOKEN_SERVICE, ITokenService } from '../ports/token.port';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepo: IAuthRepository,
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashToken(refreshToken);
    await this.authRepo.revokeRefreshTokenByHash(tokenHash);
  }
}
