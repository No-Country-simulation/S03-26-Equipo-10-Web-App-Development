import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { PrismaModule } from './prisma/prisma.module';
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
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
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
  providers: [IdempotencyInterceptor],
})
export class AppModule {}
