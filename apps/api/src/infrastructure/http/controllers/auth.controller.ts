import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { Idempotent } from '../decorators/idempotent.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import type { AuthenticatedUser } from '../../../application/interfaces/auth-context.interface';
import { LoginDto } from '../../../application/dtos/login.dto';
import { RefreshTokenDto } from '../../../application/dtos/refresh-token.dto';
import { RegisterAdminDto } from '../../../application/dtos/register-admin.dto';
import { RegisterAdminUseCase } from '../../../application/use-cases/register-admin.use-case';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { RefreshSessionUseCase } from '../../../application/use-cases/refresh-session.use-case';
import { LogoutUseCase } from '../../../application/use-cases/logout.use-case';
import { GetMeUseCase } from '../../../application/use-cases/get-me.use-case';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(
    private readonly registerAdminUseCase: RegisterAdminUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getMeUseCase: GetMeUseCase,
  ) {}

  @Post('register-admin')
  @Idempotent()
  @RateLimit({ limit: 10, windowSeconds: 60, scope: 'ip' })
  registerAdmin(@Body() dto: RegisterAdminDto) {
    return this.registerAdminUseCase.execute(dto);
  }

  @Post('login')
  @RateLimit({ limit: 5, windowSeconds: 60, scope: 'ip' })
  login(@Body() dto: LoginDto) {
    return this.loginUseCase.execute(dto);
  }

  @Post('refresh')
  @RateLimit({ limit: 20, windowSeconds: 60, scope: 'ip' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.refreshSessionUseCase.execute(dto.refreshToken);
  }

  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto) {
    await this.logoutUseCase.execute(dto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.getMeUseCase.execute(user);
  }
}
