import { AuthService } from '../services/auth.service';
import { Body, Controller, Get, Post, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { Idempotent } from '../../../common/decorators/idempotent.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import type { AuthenticatedUser } from '../../../common/interfaces/auth-context.interface';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterAdminDto } from '../dto/register-admin.dto';

/**
 * Controlador de Autenticación.
 * Maneja el registro de tenants, inicio de sesión, rotación de tokens y cierre de sesión.
 * Incluye protección contra fuerza bruta mediante el RateLimitGuard.
 */
@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Registra un nuevo administrador junto con su propio Tenant (inquilino).
   * @param dto Datos de registro (nombre del tenant, email, contraseña).
   * @param res Objeto Response de Express para establecer cookies HTTP Only.
   * @returns El usuario recién creado.
   */
  @Post('register-admin')
  @Idempotent()
  @RateLimit({ limit: 10, windowSeconds: 60, scope: 'ip' })
  async registerAdmin(@Body() dto: RegisterAdminDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.registerAdmin(dto);
    this.setAuthCookies(res, result.tokens);
    return { user: result.user };
  }

  /**
   * Inicia sesión de un usuario existente.
   * Si es exitoso, establece las cookies `accessToken` y `refreshToken`.
   * 
   * @param dto Credenciales del usuario.
   * @param res Objeto Response de Express.
   * @returns Los datos del usuario autenticado.
   */
  @Post('login')
  @RateLimit({ limit: 5, windowSeconds: 60, scope: 'ip' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setAuthCookies(res, result.tokens);
    return { user: result.user };
  }

  /**
   * Refresca la sesión utilizando el refresh token.
   * Genera un nuevo par de access y refresh tokens, invalidando el anterior (rotación).
   * 
   * @param dto Contiene el refreshToken actual (generalmente extraído por validación previa).
   * @param res Objeto Response de Express.
   */
  @Post('refresh')
  @RateLimit({ limit: 20, windowSeconds: 60, scope: 'ip' })
  async refresh(@Body() dto: RefreshTokenDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.refreshSession(dto.refreshToken);
    this.setAuthCookies(res, result.tokens);
    return { user: result.user };
  }

  /**
   * Cierra la sesión del usuario invalidando el refresh token en base de datos
   * y limpiando las cookies del navegador.
   */
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(dto.refreshToken);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return { message: 'Logged out successfully' };
  }

  /**
   * Obtiene la información del usuario actualmente autenticado basado en el token JWT.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  /**
   * Función auxiliar para establecer las cookies seguras de autenticación.
   * 
   * @param res Objeto Response
   * @param tokens Par de tokens (access y refresh)
   */
  private setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutos (hardcodeado por simplicidad, se podría extraer de config)
    });
    
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    });
  }
}
