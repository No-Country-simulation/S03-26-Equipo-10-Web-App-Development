import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';
import type { ApiRequest } from '../interfaces/auth-context.interface';
import { IdempotencyService } from '../services/idempotency.service';

/**
 * Interceptor para asegurar la idempotencia de las peticiones HTTP.
 * Si una petición contiene el header `idempotency-key` y ha sido procesada previamente,
 * devuelve la respuesta en caché en lugar de volver a ejecutar la lógica del controlador.
 * Solo actúa en métodos decorados con `@Idempotent()`.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  /**
   * Intercepta la petición para validar si ya fue procesada (caché hit).
   * Si es un caché miss, ejecuta la ruta normal y guarda el resultado en caché.
   *
   * @param context Contexto de ejecución
   * @param next Siguiente manejador en la cadena
   */
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    // Verifica si la ruta tiene el decorador @Idempotent()
    const enabled = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no está habilitado, procede normalmente
    if (!enabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<ApiRequest>();
    const response = context.switchToHttp().getResponse<{ status: (code: number) => void; statusCode: number }>();

    const key = request.header('idempotency-key');
    // Si no se provee la llave, se procesa sin idempotencia
    if (!key) {
      return next.handle();
    }

    const tenantId = request.user?.tenantId ?? request.apiKey?.tenantId;
    if (!tenantId) {
      return next.handle();
    }

    const path = request.route?.path ?? request.path;

    // Busca en Redis/Cache si ya existe una respuesta previa para esta llave
    const cached = await this.idempotencyService.get({
      key,
      tenantId,
      method: request.method,
      path,
    });

    // Cache hit: Retorna la respuesta previa y saltea la ejecución del controlador
    if (cached !== null) {
      response.status(cached.statusCode);
      return of(cached.body);
    }

    // Cache miss: Ejecuta el controlador y guarda la respuesta
    return next.handle().pipe(
      tap(async body => {
        await this.idempotencyService.save({
          key,
          tenantId,
          method: request.method,
          path,
          statusCode: response.statusCode,
          body,
        });
      }),
    );
  }
}
