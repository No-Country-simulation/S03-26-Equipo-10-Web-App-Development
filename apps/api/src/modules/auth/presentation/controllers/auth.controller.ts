import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { RateLimit } from '../../../../common/decorators/rate-limit.decorator';
import { Idempotent } from '../../../../common/decorators/idempotent.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../../../common/guards/rate-limit.guard';
import type { AuthenticatedUser } from '../../../../common/interfaces/auth-context.interface';
import { LoginDto } from '../../application/dto/login.dto';
import { RefreshTokenDto } from '../../application/dto/refresh-token.dto';
import { RegisterAdminDto } from '../../application/dto/register-admin.dto';
import { AuthService } from '../../application/services/auth.service';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register-admin')
  @Idempotent()
  @RateLimit({ limit: 10, windowSeconds: 60, scope: 'ip' })
  registerAdmin(@Body() dto: RegisterAdminDto) {
    return this.authService.registerAdmin(dto);
  }

  @Post('login')
  @RateLimit({ limit: 5, windowSeconds: 60, scope: 'ip' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @RateLimit({ limit: 20, windowSeconds: 60, scope: 'ip' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken).then(() => ({ message: 'Logged out successfully' }));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user);
  }
}
