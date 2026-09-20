import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import type { ApiRequest, RequestContext } from '../interfaces/auth-context.interface';

/**
 * Filtro global de excepciones que implementa el estándar RFC 9457 Problem Details.
 *
 * OBS-F1: Emite `Content-Type: application/problem+json` con los campos:
 * `type`, `title`, `status`, `detail`, `instance`, `code`, `traceId`, `timestamp`.
 *
 * En producción, los errores 5xx ocultan detalles internos al cliente (OBS-04).
 * Todos los errores 5xx se loguean con contexto operacional completo (OBS-05).
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<ApiRequest>();

    const requestContext = request.requestContext as RequestContext | undefined;
    const traceId = requestContext?.correlationId
      ?? request.header('x-correlation-id')
      ?? 'unknown';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    const errorCode = this.resolveErrorCode(status, payload);

    // OBS-F1+H-14: Loguear 5xx con contexto completo para observabilidad.
    // Los 4xx son errores de cliente y no representan fallas del sistema.
    if (status >= 500) {
      this.logger.error(
        {
          event: 'http.server_error',
          err: exception,
          path: request.url,
          method: request.method,
          traceId,
          tenantId: request.user?.tenantId,
          statusCode: status,
        },
        'Unhandled server error',
      );
    }

    // RFC 9457 Problem Details (https://www.rfc-editor.org/rfc/rfc9457)
    const problemDetails = {
      type: `https://api.testimonialcms.com/errors/${errorCode.toLowerCase().replace(/_/g, '-')}`,
      title: this.resolveTitle(status),
      status,
      // OBS-04: En prod, los 5xx no exponen mensajes internos al cliente
      detail: this.resolveSafeDetail(status, payload, exception),
      instance: request.url,
      code: errorCode,
      traceId,
      timestamp: new Date().toISOString(),
      // Solo incluir invalidParams si hay errores de validación (400 con array)
      ...(this.resolveInvalidParams(payload) !== undefined && {
        invalidParams: this.resolveInvalidParams(payload),
      }),
    };

    response
      .status(status)
      .header('Content-Type', 'application/problem+json')
      .json(problemDetails);
  }

  private resolveErrorCode(status: number, payload: unknown): string {
    if (payload && typeof payload === 'object' && 'code' in payload) {
      return String((payload as Record<string, unknown>).code);
    }

    switch (status) {
      case HttpStatus.BAD_REQUEST:        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:       return 'AUTH_INVALID_TOKEN';
      case HttpStatus.FORBIDDEN:          return 'ACCESS_FORBIDDEN';
      case HttpStatus.NOT_FOUND:          return 'RESOURCE_NOT_FOUND';
      case HttpStatus.CONFLICT:           return 'STATE_CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY: return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.TOO_MANY_REQUESTS:  return 'RATE_LIMITED';
      default:                            return 'INTERNAL_SERVER_ERROR';
    }
  }

  private resolveTitle(status: number): string {
    switch (status) {
      case 400: return 'Bad Request';
      case 401: return 'Unauthorized';
      case 403: return 'Forbidden';
      case 404: return 'Not Found';
      case 409: return 'Conflict';
      case 422: return 'Unprocessable Content';
      case 429: return 'Too Many Requests';
      default:  return 'Internal Server Error';
    }
  }

  /**
   * OBS-04: En producción, los errores 500 devuelven un mensaje genérico seguro
   * para no exponer detalles de implementación, stack traces ni mensajes internos.
   */
  private resolveSafeDetail(status: number, payload: unknown, exception: unknown): string {
    if (status >= 500 && process.env.NODE_ENV === 'production') {
      return 'An unexpected error occurred. Please contact support referencing the traceId.';
    }

    if (typeof payload === 'string') {
      return payload;
    }

    if (payload && typeof payload === 'object' && 'message' in payload) {
      const message = (payload as Record<string, unknown>).message;
      if (Array.isArray(message)) return 'Validation failed. See invalidParams for details.';
      return String(message);
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Operation failed';
  }

  private resolveInvalidParams(payload: unknown): unknown[] | undefined {
    if (
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      Array.isArray((payload as Record<string, unknown>).message)
    ) {
      return (payload as Record<string, unknown>).message as unknown[];
    }
    return undefined;
  }
}
