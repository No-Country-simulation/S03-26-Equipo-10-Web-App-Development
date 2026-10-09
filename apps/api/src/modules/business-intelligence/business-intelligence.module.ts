import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BiController } from './controllers/bi.controller';
import { BiConnection } from './repositories/bi-connection';
import { DashboardRepository } from './repositories/dashboard.repository';
import { DashboardService } from './services/dashboard.service';
import { BiMetricsService } from './services/bi-metrics.service';
import { BiMetricsController } from './controllers/bi-metrics.controller';

import { BiOperationsController, BiIdempotencyKeyPipe } from './controllers/bi-operations.controller';
import { BiPrivateMiddleware } from './guards/bi-private.middleware';
import { BiOperationsGuard } from './guards/bi-operations.guard';
import { BiControlConnection } from './repositories/bi-control-connection';
import { OperationsReadRepository } from './repositories/operations-read.repository';
import { OperationsControlRepository } from './repositories/operations-control.repository';
import { OperationsService } from './services/operations.service';

@Module({ controllers: [BiController, BiMetricsController, BiOperationsController], providers: [
  BiConnection, BiControlConnection, DashboardRepository, DashboardService, BiMetricsService,
  BiOperationsGuard, BiIdempotencyKeyPipe, OperationsService,
  { provide: OperationsReadRepository, inject: [BiConnection], useFactory: (connection: BiConnection) => new OperationsReadRepository(connection) },
  { provide: OperationsControlRepository, inject: [BiControlConnection], useFactory: (connection: BiControlConnection) => new OperationsControlRepository(connection) },
] })
export class BusinessIntelligenceModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(BiPrivateMiddleware).forRoutes(BiController, BiOperationsController);
  }
}
