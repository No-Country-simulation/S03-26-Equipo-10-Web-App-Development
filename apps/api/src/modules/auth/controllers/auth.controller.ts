import { BadRequestException, Body, Controller, Get, Header, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, CookieOptions } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { CsrfMode } from '../../../common/decorators/csrf-mode.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import type { AuthenticatedUser } from '../../../common/interfaces/auth-context.interface';
import { SessionCsrfService } from '../../../common/services/session-csrf.service';
import type { AppConfig } from '../../../config/app.config';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterAdminDto } from '../dto/register-admin.dto';

type AuthMode = 'cookie' | 'bearer' | 'legacy';
type SessionResult = Awaited<ReturnType<AuthService['login']>>;

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly csrf: SessionCsrfService,
    private readonly config: ConfigService,
  ) {}

  @Post('register-admin')
  @CsrfMode('origin')
  @RateLimit({ limit: 10, windowSeconds: 60, scope: 'ip' })
  async registerAdmin(@Body() dto: RegisterAdminDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const mode = this.authMode(req);
    return this.respond(await this.authService.registerAdmin(dto), mode, res);
  }

  @Post('login')
  @CsrfMode('origin')
  @RateLimit({ limit: 5, windowSeconds: 60, scope: 'ip' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const mode = this.authMode(req);
    return this.respond(await this.authService.login(dto), mode, res);
  }

  @Post('refresh')
  @CsrfMode('refresh')
  @RateLimit({ limit: 20, windowSeconds: 60, scope: 'ip' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const mode = this.authMode(req);
    const token = this.refreshToken(req, dto, mode);
    return this.respond(await this.authService.refreshSession(token), mode, res);
  }

  /** One-use bridge from the old JavaScript-held refresh token to cookies. */
  @Post('upgrade-session')
  @CsrfMode('origin')
  @RateLimit({ limit: 20, windowSeconds: 60, scope: 'ip' })
  async upgradeSession(@Body() dto: RefreshTokenDto, @Res({ passthrough: true }) res: Response) {
    this.assertLegacyWindow();
    if (!dto.refreshToken) throw new BadRequestException('Refresh token required');
    return this.respond(await this.authService.refreshSession(dto.refreshToken), 'cookie', res);
  }

  @Get('csrf')
  @Header('Cache-Control', 'no-store')
  @RateLimit({ limit: 60, windowSeconds: 60, scope: 'ip' })
  async getCsrf(@Req() req: Request) {
    const token = req.cookies?.['refreshToken'];
    if (!token) throw new UnauthorizedException('Missing refresh cookie');
    await this.authService.assertActiveRefreshToken(token);
    return { csrfToken: this.csrf.tokenFor(token) };
  }

  @Post('logout')
  @CsrfMode('refresh')
  async logout(@Body() dto: RefreshTokenDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const mode = this.authMode(req);
    const token = mode === 'cookie' ? req.cookies?.['refreshToken'] : dto.refreshToken;
    if (token) await this.authService.logout(token);
    this.clearAuthCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user: { ...user, id: user.userId } };
  }

  private authMode(req: Request): AuthMode {
    const header = req.header('x-auth-mode');
    if (header === 'cookie' || header === 'bearer') return header;
    if (header) throw new BadRequestException('Invalid authentication mode');
    this.assertLegacyWindow();
    return 'legacy';
  }

  private assertLegacyWindow(): void {
    const startedAt = this.config.getOrThrow<AppConfig>('app').authLegacyStartedAt;
    if (!startedAt && process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Explicit X-Auth-Mode required');
    }
    if (startedAt && Date.now() >= Date.parse(startedAt) + 30 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('Legacy session migration window closed');
    }
  }

  private refreshToken(req: Request, dto: RefreshTokenDto, mode: AuthMode): string {
    const token = mode === 'cookie' ? req.cookies?.['refreshToken'] : dto.refreshToken;
    if (!token) throw new UnauthorizedException('Missing refresh token');
    return token;
  }

  private respond(result: SessionResult, mode: AuthMode, res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    if (mode !== 'bearer') this.setAuthCookies(res, result.tokens);
    return mode === 'cookie' ? { user: result.user } : result;
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    };
  }

  private setAuthCookies(res: Response, tokens: SessionResult['tokens']) {
    const options = this.cookieOptions();
    res.cookie('accessToken', tokens.accessToken, { ...options, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', tokens.refreshToken, { ...options, maxAge: 7 * 24 * 60 * 60 * 1000 });
  }

  private clearAuthCookies(res: Response) {
    const options = this.cookieOptions();
    res.clearCookie('accessToken', options);
    res.clearCookie('refreshToken', options);
    // Drop the old refresh cookie whose path was /api/v1/auth/refresh.
    res.clearCookie('refreshToken', { ...options, path: '/api/v1/auth/refresh' });
    res.clearCookie('csrfToken', { ...options, httpOnly: false });
  }
}
