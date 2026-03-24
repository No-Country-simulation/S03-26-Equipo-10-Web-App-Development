import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { ApiRequest } from '../interfaces/auth-context.interface';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: ApiRequest, response: Response, next: NextFunction): void {
    const requestId = request.header('x-request-id') ?? randomUUID();
    const correlationId = request.header('x-correlation-id') ?? requestId;

    request.requestContext = {
      requestId,
      correlationId,
    };

    response.setHeader('x-request-id', requestId);
    response.setHeader('x-correlation-id', correlationId);
    next();
  }
}
