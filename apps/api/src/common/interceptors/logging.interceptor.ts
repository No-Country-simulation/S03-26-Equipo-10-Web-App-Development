import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

/**
 * Interceptor para registrar (log) las peticiones HTTP entrantes.
 * Mide el tiempo de duración de la petición y registra el método, la URL,
 * el status code y los milisegundos que tomó procesarla.
 *
 * H-08: Los logs usan objetos estructurados en lugar de string interpolation,
 * para que Pino los serialice como JSON parseable en producción.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      requestContext?: { requestId?: string };
    }>();
    const { method, url } = request;
    const requestId = request.requestContext?.requestId;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<{ statusCode: number }>();
          const durationMs = Date.now() - startTime;
          this.logger.log(
            { method, url, statusCode: response.statusCode, durationMs, requestId },
            'HTTP request completed',
          );
        },
        error: (error: unknown) => {
          const durationMs = Date.now() - startTime;
          const statusCode = (error as { status?: number })?.status ?? 500;
          this.logger.warn(
            { method, url, statusCode, durationMs, requestId },
            'HTTP request failed',
          );
        },
      }),
    );
  }
}
