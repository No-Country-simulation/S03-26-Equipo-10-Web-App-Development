import { UnauthorizedException, ConflictException, Injectable, Inject } from "@nestjs/common";
import { AUTH_REPOSITORY, IAuthRepository } from "../repositories/auth.repository";
import { TOKEN_SERVICE, ITokenService } from "../interfaces/token.port";
import { PasswordService } from "../../shared/hashing/password.service";
import { LoginAttemptsService } from "./login-attempts.service";
import { LoginDto } from "../dto/login.dto";
import { RegisterAdminDto } from "../dto/register-admin.dto";

@Injectable()
export class AuthService {
    async login(dto: LoginDto) {
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

    async logout(refreshToken: string) {
        const tokenHash = this.tokenService.hashToken(refreshToken);
        await this.authRepo.revokeRefreshTokenByHash(tokenHash);
    }

    async refreshSession(refreshToken: string) {
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

    async registerAdmin(dto: RegisterAdminDto) {
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

    constructor(@Inject(AUTH_REPOSITORY) private readonly authRepo: IAuthRepository, @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService, private readonly passwordService: PasswordService, private readonly loginAttempts: LoginAttemptsService) {
    }
}
