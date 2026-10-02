import { ApiKeyCryptoService } from '../src/common/services/api-key-crypto.service';

describe('ApiKeyCryptoService', () => {
  const settings = {
    environment: 'test' as const, currentPepperVersion: 2,
    peppers: { '1': Buffer.alloc(32, 1).toString('base64url'),
      '2': Buffer.alloc(32, 2).toString('base64url') },
    legacyStartedAt: '2026-10-01T00:00:00Z',
  };
  const crypto = new ApiKeyCryptoService({ getOrThrow: () => ({ apiKeys: settings }) } as any);

  it('issues 256-bit secrets with a unique lookup ID and verifies HMAC in constant time', () => {
    const issued = crypto.issue();
    expect(issued.raw).toMatch(/^ak_test_[0-9a-f]{16}_[0-9a-f]{64}$/);
    expect(issued.pepperVersion).toBe(2);
    expect(crypto.parse(issued.raw)).toEqual({
      environment: 'test', publicId: issued.publicId, secret: issued.secret,
    });
    expect(crypto.verify(issued.secret, 2, issued.digest)).toBe(true);
    expect(crypto.verify('0'.repeat(64), 2, issued.digest)).toBe(false);
    expect(crypto.verify(issued.secret, 1, issued.digest)).toBe(false);
    expect(crypto.parse(issued.raw + '_extra')).toBeNull();
    expect(crypto.parse(issued.raw.replace('ak_test_', 'ak_live_'))?.environment).toBe('live');
  });

  it('keeps tms_ only inside the 30-day configured window', () => {
    expect(crypto.isLegacy(`tms_${'a'.repeat(48)}`)).toBe(true);
    expect(crypto.isLegacy('tms_bad')).toBe(false);
    expect(crypto.legacyAllowed(new Date('2026-10-30T23:59:59Z'))).toBe(true);
    expect(crypto.legacyAllowed(new Date('2026-10-31T00:00:00Z'))).toBe(false);
  });
});
