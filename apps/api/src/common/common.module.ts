import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyScopesGuard } from './guards/api-key-scopes.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RolesGuard } from './guards/roles.guard';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { IdempotencyRepository } from './repositories/idempotency.repository';
import { CredentialRepository } from './repositories/credential.repository';
import { RateLimitService } from './services/rate-limit.service';
import { CacheService } from './services/cache.service';
import { RedisStoreService } from './services/redis-store.service';
import { ApiKeyCryptoService } from './services/api-key-crypto.service';
import { SessionCsrfService } from './services/session-csrf.service';
import type { AppConfig } from '../config/app.config';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<AppConfig>('app')!.jwt.secret,
      }),
    }),
  ],
  providers: [
    Reflector,
    ApiKeyGuard,
    ApiKeyScopesGuard,
    JwtAuthGuard,
    RateLimitGuard,
    RolesGuard,
    IdempotencyInterceptor,
    LoggingInterceptor,
    IdempotencyRepository,
    CredentialRepository,
    RateLimitService,
    CacheService,
    RedisStoreService,
    ApiKeyCryptoService,
    SessionCsrfService,
  ],
  exports: [
    JwtModule,
    ApiKeyGuard,
    ApiKeyScopesGuard,
    JwtAuthGuard,
    RateLimitGuard,
    RolesGuard,
    IdempotencyInterceptor,
    LoggingInterceptor,
    IdempotencyRepository,
    CredentialRepository,
    RateLimitService,
    CacheService,
    RedisStoreService,
    ApiKeyCryptoService,
    SessionCsrfService,
  ],
})
export class CommonModule {}
