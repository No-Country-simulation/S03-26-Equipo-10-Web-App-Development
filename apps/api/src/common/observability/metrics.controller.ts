import { Controller, Get, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { AppConfig } from '../../config/app.config';
import { MetricsService } from './metrics.service';

@Controller('internal')
export class MetricsController {
  constructor(private readonly metrics: MetricsService, private readonly config: ConfigService) {}

  @Get('metrics')
  async scrape(@Req() request: Request, @Res() response: Response): Promise<void> {
    const expected = this.config.getOrThrow<AppConfig>('app').metricsToken;
    const provided = request.header('x-metrics-token') ?? '';
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
      response.sendStatus(404);
      return;
    }
    response.type(this.metrics.registry.contentType).send(await this.metrics.render());
  }
}
