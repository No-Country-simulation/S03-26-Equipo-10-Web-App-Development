import { appConfigValidationSchema } from '../src/config/app.config';

const validEnvironment = {
  PORT: '4000',
  CORS_ORIGIN: 'http://localhost:3000',
  JWT_SECRET: 'test-only-placeholder-with-at-least-32-characters',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test?schema=public',
  API_KEY_PEPPERS_JSON: JSON.stringify({ 1: Buffer.alloc(32, 7).toString('base64url') }),
};

describe('application environment validation', () => {
  it('accepts a valid runtime configuration', () => {
    expect(appConfigValidationSchema.safeParse(validEnvironment).success).toBe(true);
  });

  it.each([
    ['short JWT secret', { JWT_SECRET: 'short' }],
    ['blank JWT secret', { JWT_SECRET: ' '.repeat(32) }],
    ['wrong database protocol', { DATABASE_URL: 'https://localhost/database' }],
    ['wrong Redis protocol', { REDIS_URL: 'http://localhost:6379' }],
    ['invalid API key pepper JSON', { API_KEY_PEPPERS_JSON: '{' }],
    ['missing current pepper version', { API_KEY_PEPPER_CURRENT_VERSION: '2' }],
    ['short API key pepper', { API_KEY_PEPPERS_JSON: '{"1":"short"}' }],
    ['invalid legacy API key UTC date', { API_KEY_LEGACY_STARTED_AT: '2026-10-01' }],
    ['invalid CORS origin', { CORS_ORIGIN: 'not-an-origin' }],
    ['CORS URL with a path', { CORS_ORIGIN: 'https://example.com/internal' }],
    ['out-of-range port', { PORT: '70000' }],
    ['invalid proxy hop count', { TRUST_PROXY_HOPS: '6' }],
    ['invalid legacy webhook UTC date', { WEBHOOK_LEGACY_HTTP_STARTED_AT: '2026-09-30' }],
  ])('rejects %s', (_description, override) => {
    expect(appConfigValidationSchema.safeParse({ ...validEnvironment, ...override }).success).toBe(false);
  });
});
