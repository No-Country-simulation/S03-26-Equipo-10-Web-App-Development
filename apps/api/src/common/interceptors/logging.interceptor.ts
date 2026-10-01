import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Observable, tap } from 'rxjs';
import type { RequestContext } from '../interfaces/auth-context.interface';
import { ApplicationError } from '../errors/application.error';
import { getRequestScope } from '../request-context.storage';

const applicationStatus: Record<ApplicationError['kind'], number> = {
  invalid_input: 400, unauthorized: 401, forbidden: 403,
  not_found: 404, conflict: 409, rate_limited: 429, internal: 500, unavailable: 503,
};

/**
 * Interceptor para registrar las peticiones HTTP entrantes.
 *
 * OBS-F4: Loguea la ruta parametrizada (`route.path`) en lugar de la URL dinámica,
 * eliminando la explosión de cardinalidad en métricas y dashboards (OBS-03).
 *
 * OBS-F5: Incluye `traceId` (correlationId) y `tenantId` en cada log para
 * correlación de trazas y filtrado por tenant en producción.
 *
 * Usa `nestjs-pino` (Logger inyectado) en lugar de NestJS Logger nativo para
 * garantizar serialización JSON en producción.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      route?: { path: string };
      requestContext?: RequestContext;
      user?: { tenantId?: string };
      apiKey?: { tenantId?: string };
    }>();

    const { method, url } = request;
    // OBS-F4: Ruta parametrizada de baja cardinalidad (ej. "/api/v1/testimonials/:id")
    const route = request.route?.path ?? url;
    const traceId = getRequestScope()?.correlationId ?? request.requestContext?.correlationId;
    const tenantId = getRequestScope()?.tenantId ?? request.user?.tenantId ?? request.apiKey?.tenantId;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<{ statusCode: number }>();
          const durationMs = Date.now() - startTime;
          this.logger.log({
            event: 'http.request_completed',
            http: {
              method,
              route,
              statusCode: response.statusCode,
              durationMs,
            },
            traceId,
            tenantId,
          });
        },
        error: (error: unknown) => {
          const durationMs = Date.now() - startTime;
          const statusCode = error instanceof ApplicationError
            ? applicationStatus[error.kind]
            : (error as { status?: number })?.status ?? 500;
          const errorCode =
            (error as { code?: string })?.code ?? 'UNHANDLED_EXCEPTION';
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

          this.logger.warn({
            event: 'http.request_failed',
            http: {
              method,
              route,
              statusCode,
              durationMs,
            },
            error: {
              message: errorMessage,
              code: errorCode,
            },
            traceId,
            tenantId,
          });
        },
      }),
    );
  }
}
