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

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register-admin')
  @Idempotent()
  @RateLimit({ limit: 10, windowSeconds: 60, scope: 'ip' })
  async registerAdmin(@Body() dto: RegisterAdminDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.registerAdmin(dto);
    this.setAuthCookies(res, result.tokens);
    return { user: result.user };
  }

  @Post('login')
  @RateLimit({ limit: 5, windowSeconds: 60, scope: 'ip' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setAuthCookies(res, result.tokens);
    return { user: result.user };
  }

  @Post('refresh')
  @RateLimit({ limit: 20, windowSeconds: 60, scope: 'ip' })
  async refresh(@Body() dto: RefreshTokenDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.refreshSession(dto.refreshToken);
    this.setAuthCookies(res, result.tokens);
    return { user: result.user };
  }

  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(dto.refreshToken);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

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
