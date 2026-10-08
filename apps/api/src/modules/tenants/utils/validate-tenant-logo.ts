import { InvalidInputError } from '../../../common/errors/application.error';

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Signature/container validation; Cloudinary must also successfully decode it. */
export function validateTenantLogo(value: string): string {
  if (value.length > Math.ceil(MAX_LOGO_BYTES / 3) * 4 + 32) {
    throw new InvalidInputError('Logo exceeds the 2 MiB decoded limit');
  }
  const match = /^(?:data:(image\/(?:png|jpeg|webp));base64,)?([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new InvalidInputError('Logo must be canonical Base64 PNG, JPEG or WebP');
  const encoded = match[2]!;
  const bytes = encoded.length * 3 / 4 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
  if (bytes <= 0 || bytes > MAX_LOGO_BYTES) throw new InvalidInputError('Logo exceeds the 2 MiB decoded limit');
  const data = Buffer.from(encoded, 'base64');
  if (data.length !== bytes || data.toString('base64') !== encoded) {
    throw new InvalidInputError('Logo must use canonical Base64 encoding');
  }
  let mime: string | undefined;
  if (isPng(data)) mime = 'image/png';
  else if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
    && data[data.length - 2] === 0xff && data[data.length - 1] === 0xd9) mime = 'image/jpeg';
  else if (isWebp(data)) mime = 'image/webp';
  if (!mime || (match[1] && match[1] !== mime)) {
    throw new InvalidInputError('Logo content must match a PNG, JPEG or WebP image');
  }
  return `data:${mime};base64,${encoded}`;
}

function isPng(data: Buffer): boolean {
  if (data.length < 45 || !data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return false;
  if (data.readUInt32BE(8) !== 13 || data.toString('ascii', 12, 16) !== 'IHDR'
    || data.readUInt32BE(16) === 0 || data.readUInt32BE(20) === 0) return false;
  let offset = 8;
  let hasImageData = false;
  while (offset + 12 <= data.length) {
    const size = data.readUInt32BE(offset);
    const end = offset + 12 + size;
    if (end > data.length) return false;
    const type = data.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') hasImageData = true;
    if (type === 'IEND') return size === 0 && end === data.length && hasImageData;
    offset = end;
  }
  return false;
}

function isWebp(data: Buffer): boolean {
  if (data.length < 20 || data.toString('ascii', 0, 4) !== 'RIFF'
    || data.toString('ascii', 8, 12) !== 'WEBP' || data.readUInt32LE(4) + 8 !== data.length) return false;
  let offset = 12;
  let hasImageData = false;
  while (offset + 8 <= data.length) {
    const size = data.readUInt32LE(offset + 4);
    const end = offset + 8 + size + size % 2;
    if (end > data.length) return false;
    const type = data.toString('ascii', offset, offset + 4);
    if ((type === 'VP8 ' || type === 'VP8L' || type === 'ANMF') && size > 0) hasImageData = true;
    offset = end;
  }
  return offset === data.length && hasImageData;
}
