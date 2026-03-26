import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { AUTH_REPOSITORY, IAuthRepository } from '../../core/repositories/auth.repository';
import { TOKEN_SERVICE, ITokenService } from '../ports/token.port';
import { PasswordService } from '../../infrastructure/external-services/hashing/password.service';
import { RegisterAdminDto } from '../dtos/register-admin.dto';

@Injectable()
export class RegisterAdminUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepo: IAuthRepository,
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    private readonly passwordService: PasswordService,
  ) {}

  async execute(dto: RegisterAdminDto) {
    const passwordHash = await this.passwordService.hashPassword(dto.password);

    let user;
    try {
      user = await this.authRepo.createTenantAndAdmin({
        tenantName: dto.tenantName,
        email: dto.email,
        passwordHash,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'TENANT_NAME_EXISTS') {
        throw new ConflictException('A tenant with this name already exists');
      }
      if (error instanceof Error && error.message === 'EMAIL_EXISTS') {
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }

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
