import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggerService {
  private readonly logger = new Logger('testimonial-cms-api');

  info(message: string, context?: Record<string, unknown>): void {
    this.logger.log(this.format(message, context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.logger.warn(this.format(message, context));
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.logger.error(this.format(message, context));
  }

  private format(message: string, context?: Record<string, unknown>): string {
    if (!context) {
      return message;
    }

    return `${message} ${JSON.stringify(context)}`;
  }
}
