import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common.module';
import { HashingModule } from '../external-services/hashing/hashing.module';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor';
import { PrismaModule } from '../database/prisma/prisma.module';
import { ApiKeysModule } from './routes/api-keys.module';
import { AnalyticsModule } from './routes/analytics.module';
import { AuthModule } from './routes/auth.module';
import { DocsModule } from './routes/docs.module';
import { FeatureFlagsModule } from './routes/feature-flags.module';
import { HealthModule } from './routes/health.module';
import { TenantsModule } from './routes/tenants.module';
import { TestimonialsModule } from './routes/testimonials.module';
import { UsersModule } from './routes/users.module';
import { WebhooksModule } from './routes/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../../.env'],
    }),
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
  providers: [IdempotencyInterceptor],
})
export class AppModule {}
