import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const ARGON_MEMORY_KIB = 19456;
const ARGON_PASSES = 2;
const ARGON_PARALLELISM = 1;
const ARGON_TAG_LENGTH = 32;
const ARGON_PREFIX = '$argon2id$v=19$';

// Node 24.7+ provides asynchronous Argon2. The checked-in @types/node 22
// predates this API; keep the runtime contract explicit until types are updated.
type Argon2Runtime = {
  argon2: (
    algorithm: 'argon2id',
    parameters: {
      message: string;
      nonce: Buffer;
      parallelism: number;
      tagLength: number;
      memory: number;
      passes: number;
    },
    callback: (error: Error | null, result: Buffer) => void,
  ) => void;
};

function deriveArgon2(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    (crypto as unknown as Argon2Runtime).argon2('argon2id', {
      message: password,
      nonce: salt,
      parallelism: ARGON_PARALLELISM,
      tagLength: ARGON_TAG_LENGTH,
      memory: ARGON_MEMORY_KIB,
      passes: ARGON_PASSES,
    }, (error, result) => error ? reject(error) : resolve(result));
  });
}

@Injectable()
export class PasswordService {
  async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16);
    const digest = await deriveArgon2(password, salt);
    return `${ARGON_PREFIX}m=${ARGON_MEMORY_KIB},t=${ARGON_PASSES},p=${ARGON_PARALLELISM}$${salt.toString('base64url')}$${digest.toString('base64url')}`;
  }

  needsRehash(storedHash: string): boolean {
    return !storedHash.startsWith(ARGON_PREFIX);
  }

  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    if (storedHash.startsWith(ARGON_PREFIX)) {
      const match = /^\$argon2id\$v=19\$m=19456,t=2,p=1\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/.exec(storedHash);
      if (!match) return false;
      const salt = Buffer.from(match[1]!, 'base64url');
      const expected = Buffer.from(match[2]!, 'base64url');
      if (salt.length !== 16 || expected.length !== ARGON_TAG_LENGTH) return false;
      const actual = await deriveArgon2(password, salt);
      return crypto.timingSafeEqual(expected, actual);
    }

    // Existing scrypt hashes remain verifiable until every account signs in.
    const [salt, hex, extra] = storedHash.split(':');
    if (!salt || !hex || extra || !/^[a-f\d]{128}$/i.test(hex)) return false;
    const actual = (await scrypt(password, salt, 64)) as Buffer;
    return crypto.timingSafeEqual(Buffer.from(hex, 'hex'), actual);
  }

  hashOpaqueToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
