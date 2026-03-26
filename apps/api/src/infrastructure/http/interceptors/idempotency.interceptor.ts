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
import type { ApiRequest } from '../../../application/interfaces/auth-context.interface';
import { IdempotencyService } from '../services/idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const enabled = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!enabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<ApiRequest>();
    const response = context.switchToHttp().getResponse<{ status: (code: number) => void; statusCode: number }>();

    const key = request.header('idempotency-key');
    if (!key) {
      return next.handle();
    }

    const tenantId = request.user?.tenantId ?? request.apiKey?.tenantId;
    if (!tenantId) {
      return next.handle();
    }

    const path = request.route?.path ?? request.path;

    const cached = await this.idempotencyService.get({
      key,
      tenantId,
      method: request.method,
      path,
    });

    if (cached !== null) {
      response.status(cached.statusCode);
      return of(cached.body);
    }

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
