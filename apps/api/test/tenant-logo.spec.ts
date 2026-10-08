import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { MAX_LOGO_BYTES, validateTenantLogo } from '../src/modules/tenants/utils/validate-tenant-logo';
import { TenantLogoService } from '../src/modules/tenants/services/tenant-logo.service';
import { TenantLogoCleanupProcessor } from '../src/modules/tenants/services/tenant-logo-cleanup.processor';
import { CloudinaryService } from '../src/modules/shared/cloud/cloudinary.service';
import { ConflictError, UnavailableError } from '../src/common/errors/application.error';
import { UploadTenantLogoDto } from '../src/modules/tenants/dto/upload-tenant-logo.dto';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const tenantId = '11111111-1111-4111-8111-111111111111';
const publicId = `tenant-logos/${tenantId}/22222222-2222-4222-8222-222222222222`;

describe('tenant logo input', () => {
  it('normalizes actual PNG, JPEG and WebP signatures and rejects mismatched MIME', () => {
    expect(validateTenantLogo(png)).toBe(`data:image/png;base64,${png}`);
    const jpeg = Buffer.from('ffd8ff00ffd9', 'hex').toString('base64');
    expect(validateTenantLogo(jpeg)).toContain('data:image/jpeg;');
    const webp = Buffer.alloc(24);
    webp.write('RIFF'); webp.writeUInt32LE(16, 4); webp.write('WEBPVP8 ', 8); webp.writeUInt32LE(4, 16);
    expect(validateTenantLogo(webp.toString('base64'))).toContain('data:image/webp;');
    for (const value of ['', 'abc!', 'AB==', `data:image/jpeg;base64,${png}`,
      `data:image/gif;base64,${png}`, Buffer.from('<svg></svg>').toString('base64'),
      Buffer.from(png, 'base64').subarray(0, 40).toString('base64')]) {
      expect(() => validateTenantLogo(value)).toThrow();
    }
    webp.writeUInt32LE(99, 4);
    expect(() => validateTenantLogo(webp.toString('base64'))).toThrow();
  });

  it('accepts exactly two MiB and rejects one byte above before allocating a decoded buffer', () => {
    const data = Buffer.alloc(MAX_LOGO_BYTES);
    data.set([0xff, 0xd8, 0xff], 0); data.set([0xff, 0xd9], data.length - 2);
    expect(() => validateTenantLogo(data.toString('base64'))).not.toThrow();
    expect(() => validateTenantLogo(Buffer.alloc(MAX_LOGO_BYTES + 1).toString('base64'))).toThrow('2 MiB');
  });

  it('rejects tenant IDs and arbitrary provider references in the DTO', () => {
    expect(UploadTenantLogoDto.schema.safeParse({ imageBase64: png }).success).toBe(true);
    expect(UploadTenantLogoDto.schema.safeParse({ imageBase64: png, tenantId }).success).toBe(false);
    expect(UploadTenantLogoDto.schema.safeParse({ imageBase64: png, logoPublicId: publicId }).success).toBe(false);
  });
});

describe('tenant logo upload workflow', () => {
  const state = { logoRevision: 1n, logoPublicId: 'previous' };
  const repo = { findState: jest.fn(), registerCandidate: jest.fn(), attach: jest.fn(), remove: jest.fn() };
  const cloud = { assertLogoStorage: jest.fn(), uploadLogo: jest.fn() };
  const service = new TenantLogoService(repo as any, cloud as any);
  beforeEach(() => {
    jest.resetAllMocks(); repo.findState.mockResolvedValue(state); repo.registerCandidate.mockResolvedValue('job');
    cloud.uploadLogo.mockResolvedValue({ secureUrl: 'https://res.cloudinary.com/demo/image/upload/logo.png' });
    repo.attach.mockResolvedValue({ logoUrl: 'saved' });
  });

  it('registers the durable candidate before network I/O and attaches after upload', async () => {
    await expect(service.upload(tenantId, png)).resolves.toEqual({ logoUrl: 'saved' });
    expect(repo.registerCandidate).toHaveBeenCalledWith(tenantId, expect.stringContaining(`tenant-logos/${tenantId}/`));
    expect(repo.registerCandidate.mock.invocationCallOrder[0]).toBeLessThan(cloud.uploadLogo.mock.invocationCallOrder[0]!);
    expect(repo.attach).toHaveBeenCalledWith(tenantId, state, 'job', expect.any(String), expect.any(String));
  });

  it('does not upload when the durable intent cannot be persisted', async () => {
    repo.registerCandidate.mockRejectedValue(new Error('database unavailable'));
    await expect(service.upload(tenantId, png)).rejects.toThrow('database unavailable');
    expect(cloud.uploadLogo).not.toHaveBeenCalled();
  });

  it('leaves the candidate recoverable after an ambiguous provider timeout without changing the logo', async () => {
    cloud.uploadLogo.mockRejectedValue(new UnavailableError('storage unavailable'));
    await expect(service.upload(tenantId, png)).rejects.toThrow();
    expect(repo.registerCandidate).toHaveBeenCalledTimes(1);
    expect(repo.attach).not.toHaveBeenCalled();
  });

  it('preserves the winning concurrent update and propagates the conflict', async () => {
    repo.attach.mockRejectedValue(new ConflictError('changed'));
    await expect(service.upload(tenantId, png)).rejects.toBeInstanceOf(ConflictError);
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('rejects unconfigured storage before creating an intent', async () => {
    cloud.assertLogoStorage.mockImplementation(() => { throw new UnavailableError('not configured'); });
    await expect(service.upload(tenantId, png)).rejects.toThrow();
    expect(repo.registerCandidate).not.toHaveBeenCalled();
  });
});

describe('Cloudinary logo protocol', () => {
  const http = { request: jest.fn() };
  const credentials = { cloudName: 'synthetic', apiKey: 'synthetic-key', apiSecret: 'test-only-secret' };
  const cloud = new CloudinaryService(http as any, { get: () => ({ cloudinary: { uploadUrl: '', uploadPreset: '', ...credentials } }) } as unknown as ConfigService);
  beforeEach(() => http.request.mockReset());

  it('uses a signed form body, a fixed endpoint, no overwrite and no write retry', async () => {
    http.request.mockResolvedValue({ secure_url: 'https://res.cloudinary.com/synthetic/image/upload/v1/logo.png',
      public_id: publicId, resource_type: 'image', format: 'png' });
    await cloud.uploadLogo(`data:image/png;base64,${png}`, publicId);
    const [url, request, options] = http.request.mock.calls[0]!;
    expect(url).toBe('https://api.cloudinary.com/v1_1/synthetic/image/upload');
    const params = new URLSearchParams(request.body);
    const canonical = `overwrite=false&public_id=${publicId}&timestamp=${params.get('timestamp')}`;
    expect(params.get('signature')).toBe(createHash('sha256').update(canonical + credentials.apiSecret).digest('hex'));
    expect(url).not.toContain(credentials.apiKey);
    expect(request.body).not.toContain(credentials.apiSecret);
    expect(options).toMatchObject({ retries: 0, timeoutMs: 5000 });
  });

  it.each([
    { secure_url: 'https://evil.test/logo.png', public_id: publicId, resource_type: 'image', format: 'png' },
    { secure_url: 'https://res.cloudinary.com/other/image/upload/logo.png', public_id: publicId, resource_type: 'image', format: 'png' },
    { secure_url: 'https://res.cloudinary.com/synthetic/image/upload/logo.png', public_id: 'wrong', resource_type: 'image', format: 'png' },
    { secure_url: 'https://res.cloudinary.com/synthetic/image/upload/logo.gif', public_id: publicId, resource_type: 'image', format: 'gif' },
  ])('rejects an invalid signed upload response', async response => {
    http.request.mockResolvedValue(response);
    await expect(cloud.uploadLogo(png, publicId)).rejects.toMatchObject({ code: 'MEDIA_STORAGE_UNAVAILABLE' });
  });

  it('sanitizes provider exceptions and accepts already deleted assets', async () => {
    http.request.mockRejectedValueOnce(new Error('provider credentials and raw response'))
      .mockResolvedValueOnce({ result: 'not found' });
    await expect(cloud.uploadLogo(png, publicId)).rejects.toThrow('Image storage is unavailable');
    await expect(cloud.destroyLogo(publicId)).resolves.toBeUndefined();
    expect(new URLSearchParams(http.request.mock.calls[1]![1].body).get('invalidate')).toBe('true');
  });

  it('does not silently fabricate an upload when storage is missing', async () => {
    const missing = new CloudinaryService(http as any, { get: () => ({ cloudinary: { uploadUrl: '', uploadPreset: '' } }) } as unknown as ConfigService);
    await expect(missing.uploadImage(png)).rejects.toMatchObject({ code: 'MEDIA_STORAGE_UNAVAILABLE' });
    expect(() => missing.assertLogoStorage()).toThrow();
  });
});

describe('durable logo cleanup worker', () => {
  const claim = { id: 'job', tenantId, publicId, attempts: 1, leaseToken: 'lease' };
  const repo = { dueTenants: jest.fn(), claim: jest.fn(), isReferenced: jest.fn(), finish: jest.fn() };
  const cloud = { destroyLogo: jest.fn() };
  const metrics = { recordLogoCleanup: jest.fn() };
  const worker = new TenantLogoCleanupProcessor(repo as any, cloud as any, metrics as any);
  beforeEach(() => {
    jest.resetAllMocks(); repo.dueTenants.mockResolvedValue([tenantId]); repo.claim.mockResolvedValue([claim]);
    repo.isReferenced.mockResolvedValue(false); repo.finish.mockResolvedValue(true);
  });

  it('protects an asset still referenced by the tenant', async () => {
    repo.isReferenced.mockResolvedValue(true);
    await worker.process();
    expect(cloud.destroyLogo).not.toHaveBeenCalled();
    expect(repo.finish).toHaveBeenCalledWith(claim, 'cancelled');
  });

  it('completes a successful deletion and ignores stale finalization', async () => {
    repo.finish.mockResolvedValue(false);
    await worker.process();
    expect(repo.finish).toHaveBeenCalledWith(claim, 'completed');
    expect(metrics.recordLogoCleanup).not.toHaveBeenCalled();
  });

  it('retries failures with backoff and marks the tenth failure dead', async () => {
    cloud.destroyLogo.mockRejectedValue(new Error('provider unavailable'));
    await worker.process();
    expect(repo.finish).toHaveBeenLastCalledWith(claim, 'pending', expect.any(Number), 'MEDIA_CLEANUP_FAILED');
    const tenth = { ...claim, attempts: 10 };
    repo.claim.mockResolvedValue([tenth]);
    await worker.process();
    expect(repo.finish).toHaveBeenLastCalledWith(tenth, 'dead', expect.any(Number), 'MEDIA_CLEANUP_FAILED');
    expect(metrics.recordLogoCleanup).toHaveBeenCalledWith('dead');
  });

  it('releases its local running guard after database failure', async () => {
    repo.claim.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(worker.process()).rejects.toThrow();
    await expect(worker.process()).resolves.toBeUndefined();
  });
});
