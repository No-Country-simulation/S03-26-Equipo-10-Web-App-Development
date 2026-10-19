import { afterEach, expect, it, vi } from 'vitest';
import { clearLegacySession, takeLegacyRefreshToken } from './session-store';
afterEach(() => vi.restoreAllMocks());
it('permite recuperar sesión por cookies aunque storage esté denegado', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  expect(takeLegacyRefreshToken()).toBeNull();
  expect(() => clearLegacySession()).not.toThrow();
});
it('no utiliza una credencial legada si no puede consumirla antes del intento', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(
    JSON.stringify({
      tokens: { refreshToken: 'synthetic-legacy-credential-value' },
    }),
  );
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  expect(takeLegacyRefreshToken()).toBeNull();
});
