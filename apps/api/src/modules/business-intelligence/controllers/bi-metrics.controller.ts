import { Controller, Get, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { AppConfig } from '../../../config/app.config';
import { BiMetricsService } from '../services/bi-metrics.service';

@Controller('internal/bi')
export class BiMetricsController {
  constructor(private readonly metrics: BiMetricsService, private readonly config: ConfigService) {}
  @Get('metrics')
  async scrape(@Req() request: Request, @Res() response: Response): Promise<void> {
    const expected = this.config.getOrThrow<AppConfig>('app').metricsToken;
    const a = Buffer.from(expected); const b = Buffer.from(request.header('x-metrics-token') ?? '');
    if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) { response.sendStatus(404); return; }
    response.setHeader('Cache-Control', 'no-store');
    response.type('text/plain; version=0.0.4; charset=utf-8').send(await this.metrics.render());
  }
}
