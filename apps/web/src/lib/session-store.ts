import { SessionPayload } from './api';

const SESSION_KEY = 'testimonial-cms.session';

export function getStoredSession(): SessionPayload | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = window.localStorage.getItem(SESSION_KEY);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as SessionPayload;
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
