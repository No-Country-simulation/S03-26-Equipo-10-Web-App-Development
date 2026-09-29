import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { ApiRequest } from '../interfaces/auth-context.interface';
import { runWithRequestScope } from '../request-context.storage';

function validIdentifier(value: string | undefined): string | undefined {
  return value && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : undefined;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: ApiRequest, response: Response, next: NextFunction): void {
    const requestId = validIdentifier(request.header('x-request-id')) ?? randomUUID();
    const correlationId = validIdentifier(request.header('x-correlation-id')) ?? requestId;

    request.requestContext = {
      requestId,
      correlationId,
    };

    response.setHeader('x-request-id', requestId);
    response.setHeader('x-correlation-id', correlationId);
    runWithRequestScope({ requestId, correlationId }, next);
  }
}
