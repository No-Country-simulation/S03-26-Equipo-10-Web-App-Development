import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** Runs before global/local guards, so error responses are also private. */
@Injectable()
export class BiPrivateMiddleware implements NestMiddleware {
  use(_request: Request, response: Response, next: NextFunction): void {
    response.setHeader('Cache-Control', 'private, no-store'); next();
  }
}
