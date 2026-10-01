const SESSION_KEY = 'testimonial-cms.session';
/** Read and erase the old token before attempting the one-use upgrade. */
export function takeLegacyRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(SESSION_KEY);
  window.localStorage.removeItem(SESSION_KEY);
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || !('tokens' in parsed)) return null;
    const tokens = (parsed as { tokens?: { refreshToken?: unknown } }).tokens;
    return typeof tokens?.refreshToken === 'string' && tokens.refreshToken.length >= 20
      ? tokens.refreshToken : null;
  } catch {
    return null;
  }
}

export function clearLegacySession() {
  if (typeof window !== 'undefined') window.localStorage.removeItem(SESSION_KEY);
}
