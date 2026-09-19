import { Injectable, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import type { ApiRequest } from '../interfaces/auth-context.interface';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: ApiRequest & { csrfToken?: string }, res: Response, next: NextFunction) {
    let csrfToken = req.cookies['csrfToken'];
    
    if (!csrfToken) {
      csrfToken = randomBytes(32).toString('hex');
      res.cookie('csrfToken', csrfToken, {
        httpOnly: false, // The client needs to read this to send it in the header
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
    }
    
    // Adjunta el token al request para que el guard pueda leerlo sin acceso a la cookie
    (req as ApiRequest & { csrfToken?: string }).csrfToken = csrfToken;
    
    next();
  }
}
