import { Module } from '@nestjs/common';
import { BiController } from './controllers/bi.controller';
import { BiConnection } from './repositories/bi-connection';
import { DashboardRepository } from './repositories/dashboard.repository';
import { DashboardService } from './services/dashboard.service';
import { BiMetricsService } from './services/bi-metrics.service';
import { BiMetricsController } from './controllers/bi-metrics.controller';

@Module({ controllers: [BiController, BiMetricsController], providers: [BiConnection, DashboardRepository, DashboardService, BiMetricsService] })
export class BusinessIntelligenceModule {}
