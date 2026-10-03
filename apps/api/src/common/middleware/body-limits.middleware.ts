import { json, urlencoded, type RequestHandler } from 'express';

const generalJson = json({ limit: '1mb' });
// A 10 MiB image expands to ~13.34 MiB when encoded as base64 in JSON.
const imageJson = json({ limit: '14mb' });
const formBody = urlencoded({ extended: true, limit: '1mb' });

export function isImagePayloadRoute(method: string, path: string): boolean {
  return method === 'POST' && (
    /^\/api\/v1\/testimonials\/[^/]+\/image\/?$/.test(path) ||
    /^\/api\/v1\/public\/testimonials\/[^/]+\/submit\/?$/.test(path)
  );
}

export const boundedJsonBody: RequestHandler = (request, response, next) =>
  (isImagePayloadRoute(request.method, request.path) ? imageJson : generalJson)(request, response, next);

export { formBody };
