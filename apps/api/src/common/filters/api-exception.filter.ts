import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

/**
 * Filtro global de excepciones que serializa todos los errores al formato
 * de envelope estándar del proyecto.
 *
 * H-14: Loguea los errores 5xx con contexto operacional (requestId, path, exception)
 * para observabilidad en producción. Los errores 4xx no se loguean ya que son
 * parte del flujo normal del negocio (validaciones, recursos no encontrados, etc.).
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest<{
      url: string;
      method: string;
      requestContext?: { requestId?: string };
    }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    // H-14: Loguear errores 5xx con contexto completo para observabilidad.
    // Los 4xx son errores de cliente y no representan fallas del sistema.
    if (status >= 500) {
      this.logger.error(
        {
          err: exception,
          path: request.url,
          method: request.method,
          requestId: request.requestContext?.requestId,
          statusCode: status,
        },
        'Unhandled server error',
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code: this.resolveCode(status, payload),
        message: this.resolveMessage(payload, exception),
        details: this.resolveDetails(payload),
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId: request.requestContext?.requestId,
      },
    });
  }

  private resolveCode(status: number, payload: unknown): string {
    if (payload && typeof payload === 'object' && 'code' in payload) {
      return String(payload.code);
    }

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      default:
        return 'INTERNAL_ERROR';
    }
  }

  private resolveMessage(payload: unknown, exception: unknown): string {
    if (typeof payload === 'string') {
      return payload;
    }

    if (payload && typeof payload === 'object' && 'message' in payload) {
      const message = payload.message;
      if (Array.isArray(message)) {
        return 'Request validation failed';
      }
      return String(message);
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Unexpected error';
  }

  private resolveDetails(payload: unknown) {
    if (!payload || typeof payload !== 'object' || !('message' in payload)) {
      return undefined;
    }

    return Array.isArray(payload.message) ? payload.message : undefined;
  }
}
