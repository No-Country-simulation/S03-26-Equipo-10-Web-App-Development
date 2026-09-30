import { appConfigValidationSchema } from '../src/config/app.config';

const validEnvironment = {
  PORT: '4000',
  CORS_ORIGIN: 'http://localhost:3000',
  JWT_SECRET: 'test-only-placeholder-with-at-least-32-characters',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test?schema=public',
};

describe('application environment validation', () => {
  it('accepts a valid runtime configuration', () => {
    expect(appConfigValidationSchema.safeParse(validEnvironment).success).toBe(true);
  });

  it.each([
    ['short JWT secret', { JWT_SECRET: 'short' }],
    ['blank JWT secret', { JWT_SECRET: ' '.repeat(32) }],
    ['wrong database protocol', { DATABASE_URL: 'https://localhost/database' }],
    ['invalid CORS origin', { CORS_ORIGIN: 'not-an-origin' }],
    ['CORS URL with a path', { CORS_ORIGIN: 'https://example.com/internal' }],
    ['out-of-range port', { PORT: '70000' }],
    ['invalid proxy hop count', { TRUST_PROXY_HOPS: '6' }],
  ])('rejects %s', (_description, override) => {
    expect(appConfigValidationSchema.safeParse({ ...validEnvironment, ...override }).success).toBe(false);
  });
});
