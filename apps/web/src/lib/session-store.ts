import type { SessionPayload } from './api';

const SESSION_KEY = 'testimonial-cms.session';

/**
 * Type guard mínimo para verificar que el valor parseado del localStorage
 * tiene la forma de un SessionPayload.
 *
 * H-12: Previene que datos corruptos o de versiones anteriores pasen como sesión válida.
 */
function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== 'object') return false;

  const v = value as Record<string, unknown>;
  return (
    typeof v['user'] === 'object' &&
    v['user'] !== null &&
    typeof v['tokens'] === 'object' &&
    v['tokens'] !== null &&
    typeof (v['tokens'] as Record<string, unknown>)['accessToken'] === 'string' &&
    typeof (v['tokens'] as Record<string, unknown>)['refreshToken'] === 'string'
  );
}

export function getStoredSession(): SessionPayload | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = window.localStorage.getItem(SESSION_KEY);
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!isSessionPayload(parsed)) {
      // El dato es corrupto o de una versión anterior — limpiar y forzar re-login
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(session: SessionPayload) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
}
