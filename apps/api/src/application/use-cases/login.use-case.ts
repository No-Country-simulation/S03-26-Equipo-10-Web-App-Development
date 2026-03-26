import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, IAuthRepository } from '../../core/repositories/auth.repository';
import { TOKEN_SERVICE, ITokenService } from '../ports/token.port';
import { PasswordService } from '../../infrastructure/external-services/hashing/password.service';
import { LoginAttemptsService } from '../services/login-attempts.service';
import { LoginDto } from '../dtos/login.dto';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepo: IAuthRepository,
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    private readonly passwordService: PasswordService,
    private readonly loginAttempts: LoginAttemptsService,
  ) {}

  async execute(dto: LoginDto) {
    this.loginAttempts.assertNotBlocked(dto.email);

    const user = await this.authRepo.findUserByEmail(dto.email);
    if (!user) {
      this.loginAttempts.registerFailure(dto.email);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');
    if (!user.tenantIsActive) throw new UnauthorizedException('Tenant is disabled');

    const validPassword = await this.passwordService.verifyPassword(
      dto.password,
      user.passwordHash,
    );
    if (!validPassword) {
      this.loginAttempts.registerFailure(dto.email);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.loginAttempts.clear(dto.email);

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles,
    });

    const refreshToken = this.tokenService.generateRefreshToken();
    await this.authRepo.createRefreshToken(
      user.id,
      this.tokenService.hashToken(refreshToken),
      this.tokenService.getRefreshExpiresAt(),
    );

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
        refreshToken,
      },
    };
  }
}
