import { raw, json, urlencoded, type RequestHandler } from 'express';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

const financialRaw = raw({ type: 'application/json', limit: '256kb', inflate: false });
// Node 24 supplies reviver source text: retain long MP identifiers exactly.
const financialJson = json({ limit: '256kb', inflate: false,
  reviver: (key: string, value: unknown, context?: { source?: string }) =>
    key === 'id' && typeof value === 'number' && !Number.isSafeInteger(value) && context?.source
      ? context.source : value,
});
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
  if (request.method === 'POST' && /^\/api\/v1\/billing\/webhooks\/(stripe|mercadopago)\/?$/.test(request.path)) {
    const parser = /\/stripe\/?$/.test(request.path) ? financialRaw : financialJson;
    parser(request, response, (error: unknown) => {
      if (error) {
        next(error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large'
          ? new PayloadTooLargeException('Financial notification exceeds 256 KiB')
          : new BadRequestException('Invalid financial notification body'));
        return;
      }
      next();
    });
    return;
  }
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
