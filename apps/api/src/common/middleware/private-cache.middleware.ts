import type { RequestHandler } from 'express';

// Run before guards/body parsing so errors and unauthenticated responses also
// stay private. Redis public caching remains an application concern.
export const privateApiCache: RequestHandler = (_request, response, next) => {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('CDN-Cache-Control', 'no-store');
  response.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  next();
};
