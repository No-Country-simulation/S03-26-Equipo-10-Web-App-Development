import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    let csrfToken = req.cookies['csrfToken'];
    
    if (!csrfToken) {
      csrfToken = randomBytes(32).toString('hex');
      res.cookie('csrfToken', csrfToken, {
        httpOnly: false, // The client needs to read this to send it in the header
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
    }
    
    // Pass the token to the request object so the guard can access it if needed
    (req as any).csrfToken = csrfToken;
    
    next();
  }
}
