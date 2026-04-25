import { UnauthorizedException, ConflictException, Injectable } from "@nestjs/common";
import { AuthRepository } from "../repositories/auth.repository";
import { JwtTokenService } from "./jwt-token.service";
import { PasswordService } from "../../shared/hashing/password.service";
import { LoginAttemptsService } from "./login-attempts.service";
import { LoginDto } from "../dto/login.dto";
import { RegisterAdminDto } from "../dto/register-admin.dto";

/**
 * Servicio encargado de la lógica de negocio para autenticación.
 * Gestiona validación de credenciales, tokens, y persistencia de sesiones.
 */
@Injectable()
export class AuthService {
    constructor(
        private readonly authRepo: AuthRepository, 
        private readonly tokenService: JwtTokenService, 
        private readonly passwordService: PasswordService, 
        private readonly loginAttempts: LoginAttemptsService
    ) {}

    /**
     * Inicia sesión validando credenciales y generando tokens de acceso.
     * 
     * @param dto Objeto con email y contraseña.
     * @returns Datos del usuario y el nuevo par de tokens.
     * @throws {UnauthorizedException} Si las credenciales son inválidas o la cuenta está desactivada.
     */
    async login(dto: LoginDto) {
        // Verifica que el usuario no esté bloqueado temporalmente por intentos fallidos
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

    /**
     * Invalida un refresh token específico en la base de datos, cerrando la sesión asociada.
     * @param refreshToken El token sin hashear que envió el cliente.
     */
    async logout(refreshToken: string) {
        const tokenHash = this.tokenService.hashToken(refreshToken);
        await this.authRepo.revokeRefreshTokenByHash(tokenHash);
    }

    /**
     * Refresca los tokens de acceso utilizando un refresh token válido.
     * Implementa "Refresh Token Rotation" para mayor seguridad.
     * 
     * @param refreshToken Token de refresco actual.
     * @returns Nuevos tokens y la info del usuario.
     */
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

    /**
     * Registra un nuevo administrador (dueño) junto con su organización/tenant.
     * 
     * @param dto Datos del nuevo tenant y credenciales del admin.
     * @returns Datos del usuario creado y sus tokens de sesión.
     * @throws {ConflictException} Si el nombre del tenant o el email ya están en uso.
     */
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
}
