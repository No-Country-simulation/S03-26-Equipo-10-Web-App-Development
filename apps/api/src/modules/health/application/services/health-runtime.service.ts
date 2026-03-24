import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class HealthRuntimeService {
  constructor(private readonly prisma: PrismaService) {}

  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      service: 'testimonial-cms-api',
      database: 'reachable',
      timestamp: new Date().toISOString(),
    };
  }

  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ready',
      checks: {
        database: 'ok',
      },
      timestamp: new Date().toISOString(),
    };
  }

  live() {
    return {
      status: 'live',
      timestamp: new Date().toISOString(),
    };
  }
}

