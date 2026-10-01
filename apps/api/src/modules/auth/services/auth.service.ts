import { UnauthorizedError } from '../../../common/errors/application.error';
import { Injectable } from '@nestjs/common';
import { AuthRepository } from '../repositories/auth.repository';
import { JwtTokenService } from './jwt-token.service';
import { PasswordService } from '../../shared/hashing';
import { LoginAttemptsService } from './login-attempts.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterAdminDto } from '../dto/register-admin.dto';

/** Forma del usuario autenticado que el sistema devuelve al cliente. */
interface AuthUserBase {
  id: string;
  email: string;
  tenantId: string;
  tenantName: string;
  roles: string[];
  isActive: boolean;
  createdAt: Date;
}

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
    private readonly loginAttempts: LoginAttemptsService,
  ) {}

  /**
   * Inicia sesión validando credenciales y generando tokens de acceso.
   *
   * @param dto Objeto con email y contraseña.
   * @returns Datos del usuario y el nuevo par de tokens.
   * @throws {UnauthorizedError} Si las credenciales son inválidas o la cuenta está desactivada.
   */
  async login(dto: LoginDto) {
    // Verifica que el usuario no esté bloqueado temporalmente por intentos fallidos
    await this.loginAttempts.assertNotBlocked(dto.email);

    const user = await this.authRepo.findUserByEmail(dto.email);
    if (!user) {
      await this.loginAttempts.registerFailure(dto.email);
      throw new UnauthorizedError('Invalid credentials');
    }
    if (!user.isActive) throw new UnauthorizedError('Account is disabled');
    if (!user.tenantIsActive) throw new UnauthorizedError('Tenant is disabled');

    const validPassword = await this.passwordService.verifyPassword(
      dto.password,
      user.passwordHash,
    );
    if (!validPassword) {
      await this.loginAttempts.registerFailure(dto.email);
      throw new UnauthorizedError('Invalid credentials');
    }

    await this.loginAttempts.clear(dto.email);
    if (this.passwordService.needsRehash(user.passwordHash)) {
      await this.authRepo.upgradePasswordHash(
        user.id, user.passwordHash, await this.passwordService.hashPassword(dto.password),
      );
    }
    return this.createSessionResponse(user);
  }

  /**
   * Invalida un refresh token específico en la base de datos, cerrando la sesión asociada.
   * @param refreshToken El token sin hashear que envió el cliente.
   */
  async logout(refreshToken: string) {
    const tokenHash = this.tokenService.hashToken(refreshToken);
    await this.authRepo.revokeSessionFamilyByHash(tokenHash);
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
    const record = await this.authRepo.findRefreshTokenByHash(tokenHash);
    if (!record) throw new UnauthorizedError('Invalid or expired refresh token');

    const user = record.user;
    if (!user.isActive) throw new UnauthorizedError('Account is disabled');
    if (!user.tenantIsActive) throw new UnauthorizedError('Tenant is disabled');

    const nextRefreshToken = this.tokenService.generateRefreshToken();
    const familyId = await this.authRepo.rotateRefreshToken(
      tokenHash, this.tokenService.hashToken(nextRefreshToken), this.tokenService.getRefreshExpiresAt(),
    );
    return this.buildSessionResponse(user, familyId, nextRefreshToken);
  }

  async assertActiveRefreshToken(refreshToken: string): Promise<void> {
    const record = await this.authRepo.findRefreshTokenByHash(this.tokenService.hashToken(refreshToken));
    if (!record || record.revoked || record.expiresAt <= new Date() ||
      record.familyRevokedAt || (record.familyExpiresAt && record.familyExpiresAt <= new Date()) ||
      !record.user.isActive || !record.user.tenantIsActive) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  /**
   * Registra un nuevo administrador (dueño) junto con su organización/tenant.
   *
   * @param dto Datos del nuevo tenant y credenciales del admin.
   * @returns Datos del usuario creado y sus tokens de sesión.
   * @throws {ConflictError} Si el nombre del tenant o el email ya están en uso.
   */
  async registerAdmin(dto: RegisterAdminDto) {
    const passwordHash = await this.passwordService.hashPassword(dto.password);

    const user = await this.authRepo.createTenantAndAdmin({
      tenantName: dto.tenantName,
      email: dto.email,
      passwordHash,
    });

    return this.createSessionResponse(user);
  }

  /**
   * H-13: Genera el par access/refresh token y arma el envelope de respuesta de sesión.
   * Centraliza la lógica que antes se duplicaba en login(), refreshSession() y registerAdmin().
   */
  private async createSessionResponse(user: AuthUserBase) {
    const refreshToken = this.tokenService.generateRefreshToken();
    const familyId = await this.authRepo.createRefreshSession(
      user.id, this.tokenService.hashToken(refreshToken), this.tokenService.getRefreshExpiresAt(),
    );
    return this.buildSessionResponse(user, familyId, refreshToken);
  }

  private async buildSessionResponse(user: AuthUserBase, familyId: string, refreshToken: string) {
    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles,
      sid: familyId,
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
        refreshToken,
      },
    };
  }
}
