import { PasswordService } from '../src/modules/shared/hashing/password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes and verifies passwords', async () => {
    const hash = await service.hashPassword('Admin123!');

    await expect(service.verifyPassword('Admin123!', hash)).resolves.toBe(true);
    await expect(service.verifyPassword('Wrong123!', hash)).resolves.toBe(false);
  });

  it('hashes opaque tokens deterministically', () => {
    expect(service.hashOpaqueToken('abc')).toBe(service.hashOpaqueToken('abc'));
    expect(service.hashOpaqueToken('abc')).not.toBe(service.hashOpaqueToken('xyz'));
  });
});

