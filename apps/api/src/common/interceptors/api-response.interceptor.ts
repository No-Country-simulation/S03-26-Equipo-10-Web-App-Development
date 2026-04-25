import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

/**
 * Interceptor que estandariza el formato de respuesta de la API.
 * Convierte cualquier respuesta devuelta por los controladores a un formato
 * uniforme con `{ success: true, data: payload, meta: ... }`.
 *
 * @class ApiResponseInterceptor
 * @implements {NestInterceptor}
 */
@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  /**
   * Intercepta la respuesta y la transforma al formato estándar.
   *
   * @param _context - El contexto de ejecución actual.
   * @param next - El siguiente manejador (handler) en la cadena.
   * @returns Un Observable que emite la respuesta formateada.
   */
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map(payload => {
        if (
          payload &&
          typeof payload === 'object' &&
          'items' in payload &&
          'meta' in payload
        ) {
          return {
            success: true,
            data: payload.items,
            meta: payload.meta,
          };
        }

        return {
          success: true,
          data: payload,
        };
      }),
    );
  }
}
