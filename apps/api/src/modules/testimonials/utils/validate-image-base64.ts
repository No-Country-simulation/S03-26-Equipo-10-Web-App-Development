import { InvalidInputError } from '../../../common/errors/application.error';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Validate before allocating a decoded buffer or committing a public submission. */
export function validateImageBase64(value: string): void {
  const match = /^(?:data:image\/(?:png|jpeg|webp|gif);base64,)?([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new InvalidInputError('Image must be valid base64 PNG, JPEG, WebP or GIF data');
  const encoded = match[1]!;
  const decodedBytes = encoded.length * 3 / 4 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
  if (decodedBytes === 0 || decodedBytes > MAX_IMAGE_BYTES) {
    throw new InvalidInputError('Image exceeds the 10 MB decoded limit');
  }
  const decoded = Buffer.from(encoded, 'base64');
  if (decoded.length !== decodedBytes || decoded.toString('base64') !== encoded) {
    throw new InvalidInputError('Image must use canonical base64 encoding');
  }
}
