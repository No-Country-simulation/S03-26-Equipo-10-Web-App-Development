import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CsrfGuard } from './common/guards/csrf.guard';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { appConfig, appConfigValidationSchema } from './config/app.config';
import { CommonModule } from './common/common.module';
import { HashingModule } from './modules/shared/hashing/hashing.module';
import { PrismaModule } from './modules/database/prisma.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { BusinessIntelligenceModule } from './modules/business-intelligence/business-intelligence.module';
import { AuthModule } from './modules/auth/auth.module';
import { DocsModule } from './modules/docs/docs.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { HealthModule } from './modules/health/health.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { TestimonialsModule } from './modules/testimonials/testimonials.module';
import { UsersModule } from './modules/users/users.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { getRequestScope } from './common/request-context.storage';
import { TelemetryShutdownService } from './common/observability/telemetry-shutdown.service';
import { serializeSafeRequest } from './common/observability/safe-request-serializer';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../../.env'],
      load: [appConfig],
      validate: (env) => appConfigValidationSchema.parse(env),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        // LoggingInterceptor emits normalized request records; pino-http's
        // automatic records would include the raw URL and query string.
        autoLogging: false,
        // Request-scoped child loggers still bind `req`; restrict that binding
        // to stable metadata so unrelated service logs cannot leak raw URLs.
        serializers: {
          req: serializeSafeRequest,
        },
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        // En producción, emitir JSON crudo (Loki/ELK); en dev, formatear para legibilidad
        ...(process.env.NODE_ENV !== 'production' && {
          transport: { target: 'pino-pretty' },
        }),
        // OBS-F3: Redactar secretos y PII para prevenir fugas en logs (OBS-02)
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-csrf-token"]',
            'req.headers["x-metrics-token"]',
            'res.headers["set-cookie"]',
            'req.body.password',
            'req.body.token',
            'req.body.apiKey',
            'req.body.refreshToken',
            'req.body.secret',
          ],
          censor: '[REDACTED]',
        },
        // Inyectar traceId y tenantId automáticamente en cada log HTTP
        customProps: (req: object) => ({
          traceId: getRequestScope()?.traceId ?? getRequestScope()?.correlationId
            ?? (req as { requestContext?: { traceId?: string; correlationId?: string } }).requestContext?.traceId
            ?? (req as { requestContext?: { correlationId?: string } }).requestContext?.correlationId,
          tenantId: getRequestScope()?.tenantId
            ?? (req as { user?: { tenantId?: string }; apiKey?: { tenantId?: string } }).user?.tenantId
            ?? (req as { apiKey?: { tenantId?: string } }).apiKey?.tenantId,
        }),
      },
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    HashingModule,
    CommonModule,
    DocsModule,
    HealthModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    TestimonialsModule,
    ApiKeysModule,
    AnalyticsModule,
    BusinessIntelligenceModule,
    WebhooksModule,
    FeatureFlagsModule,
  ],
  providers: [
    TelemetryShutdownService,
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule {}
