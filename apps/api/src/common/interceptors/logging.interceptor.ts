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
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  /**
   * Intercepta la petición, mide su tiempo y la registra en consola al finalizar.
   * Si falla, registra el error como una advertencia (warn).
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - startTime;
          this.logger.log(
            `${method} ${url} ${response.statusCode} — ${duration}ms`,
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const status = error?.status ?? 500;
          this.logger.warn(
            `${method} ${url} ${status} — ${duration}ms`,
          );
        },
      }),
    );
  }
}
