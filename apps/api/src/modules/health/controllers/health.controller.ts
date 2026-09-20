import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { PrismaHealthIndicator } from '../services/prisma-health.indicator';

/**
 * Expone sondas de salud con separación estricta de responsabilidades.
 *
 * OBS-F2: Desacopla Liveness de Readiness para evitar reinicios destructivos
 * cuando PostgreSQL se reinicia o degrada temporalmente (antipatrón OBS-06).
 *
 * - GET /health/live  → Liveness probe: Solo evalúa el proceso Node.js (heap).
 *                       Si PostgreSQL cae, el proceso NO se reinicia.
 * - GET /health/ready → Readiness probe: Evalúa PostgreSQL via Prisma.
 *                       Si falla, el balanceador retira la instancia sin matarla.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prismaHealthIndicator: PrismaHealthIndicator,
  ) {}

  /**
   * Liveness Probe — Jamás consulta dependencias externas.
   * Verifica únicamente que el heap de Node.js esté dentro de límites operables.
   */
  @Get('live')
  @HealthCheck()
  checkLiveness() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300 MB
    ]);
  }

  /**
   * Readiness Probe — Verifica que la aplicación puede atender tráfico real.
   * Evalúa la conectividad con PostgreSQL a través de PrismaHealthIndicator.
   */
  @Get('ready')
  @HealthCheck()
  checkReadiness() {
    return this.health.check([
      () => this.prismaHealthIndicator.isHealthy('database'),
    ]);
  }
}
