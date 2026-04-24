import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { CsrfGuard } from './common/guards/csrf.guard';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { appConfig, appConfigValidationSchema } from './config/app.config';
import { CommonModule } from './common/common.module';
import { HashingModule } from './modules/shared/hashing/hashing.module';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { PrismaModule } from './modules/database/prisma.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { DocsModule } from './modules/docs/docs.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { HealthModule } from './modules/health/health.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { TestimonialsModule } from './modules/testimonials/testimonials.module';
import { UsersModule } from './modules/users/users.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

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
        transport: { target: 'pino-pretty' },
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
    WebhooksModule,
    FeatureFlagsModule,
  ],
  providers: [
    IdempotencyInterceptor,
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}


