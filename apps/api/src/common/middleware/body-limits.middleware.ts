import { json, urlencoded, type RequestHandler } from 'express';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

const generalJson = json({ limit: '1mb' });
// A 10 MiB image expands to ~13.34 MiB when encoded as base64 in JSON.
const imageJson = json({ limit: '14mb' });
const logoJson = json({ limit: '3mb' });
const formBody = urlencoded({ extended: true, limit: '1mb' });

export function isImagePayloadRoute(method: string, path: string): boolean {
  return method === 'POST' && (
    /^\/api\/v1\/testimonials\/[^/]+\/image\/?$/.test(path) ||
    /^\/api\/v1\/public\/testimonials\/[^/]+\/submit\/?$/.test(path)
  );
}

export function isLogoPayloadRoute(method: string, path: string): boolean {
  return method === 'PUT' && /^\/api\/v1\/tenants\/me\/logo\/?$/.test(path);
}

export const boundedJsonBody: RequestHandler = (request, response, next) => {
  if (isLogoPayloadRoute(request.method, request.path)) {
    logoJson(request, response, (error: unknown) => {
      // Nest's global filter handles HttpException, not body-parser's native errors.
      if (error && typeof error === 'object' && 'type' in error) {
        if (error.type === 'entity.too.large') {
          next(new PayloadTooLargeException({ message: 'Logo request exceeds 3 MiB', code: 'PAYLOAD_TOO_LARGE' }));
          return;
        }
        if (error.type === 'entity.parse.failed') {
          next(new BadRequestException('Invalid logo JSON body'));
          return;
        }
      }
      next(error);
    });
    return;
  }
  const parser = isImagePayloadRoute(request.method, request.path) ? imageJson : generalJson;
  parser(request, response, next);
};

export { formBody };
