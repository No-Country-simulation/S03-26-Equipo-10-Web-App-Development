import { PasswordService } from '../src/modules/shared/hashing/password.service';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes and verifies passwords', async () => {
    const hash = await service.hashPassword('Admin123!');
    expect(hash).toMatch(/^\$argon2id\$v=19\$/);

    await expect(service.verifyPassword('Admin123!', hash)).resolves.toBe(true);
    await expect(service.verifyPassword('Wrong123!', hash)).resolves.toBe(false);
  });

  it('verifies an existing scrypt hash and marks it for upgrade', async () => {
    const salt = randomBytes(16).toString('hex');
    const digest = await promisify(scryptCallback)('Admin123!', salt, 64) as Buffer;
    const legacyHash = `${salt}:${digest.toString('hex')}`;
    expect(service.needsRehash(legacyHash)).toBe(true);
    await expect(service.verifyPassword('Admin123!', legacyHash)).resolves.toBe(true);
    await expect(service.verifyPassword('wrong', legacyHash)).resolves.toBe(false);
  });

  it('hashes opaque tokens deterministically', () => {
    expect(service.hashOpaqueToken('abc')).toBe(service.hashOpaqueToken('abc'));
    expect(service.hashOpaqueToken('abc')).not.toBe(service.hashOpaqueToken('xyz'));
  });
});
