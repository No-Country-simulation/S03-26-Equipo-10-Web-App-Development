import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './guards/api-key.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RolesGuard } from './guards/roles.guard';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor';
import { IdempotencyService } from './services/idempotency.service';
import { RateLimitService } from './services/rate-limit.service';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  providers: [
    Reflector,
    ApiKeyGuard,
    JwtAuthGuard,
    RateLimitGuard,
    RolesGuard,
    IdempotencyInterceptor,
    IdempotencyService,
    RateLimitService,
  ],
  exports: [
    JwtModule,
    ApiKeyGuard,
    JwtAuthGuard,
    RateLimitGuard,
    RolesGuard,
    IdempotencyInterceptor,
    IdempotencyService,
    RateLimitService,
  ],
})
export class CommonModule {}


