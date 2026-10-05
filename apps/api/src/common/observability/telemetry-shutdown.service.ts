import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { shutdownTelemetry } from '../../telemetry';

@Injectable()
export class TelemetryShutdownService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await shutdownTelemetry();
  }
}
