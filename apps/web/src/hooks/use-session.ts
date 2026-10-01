'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SessionPayload, ApiError } from '@/lib/api';
import { authenticatedRequest, recoverSession, logout as logoutApi, clearSessionMemory } from '@/features/auth/api';
import { clearLegacySession } from '@/lib/session-store';

/**
 * Hook de React para gestionar la sesión del usuario en el cliente.
 * Se encarga de cargar la sesión persistida, proveer headers de autenticación
 * y envolver las llamadas a la API para manejar la expiración del token (401).
 * 
 * @param options.redirectTo URL de redirección en caso de que la sesión no exista o caduque.
 */
export function useSession({ redirectTo = '/admin/login' }: { redirectTo?: string | null } = {}) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    void recoverSession().then(restored => {
      if (active) setSession(restored);
    }).catch(() => {
      if (active && redirectTo) router.replace(redirectTo);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [redirectTo, router]);

  /**
   * Envuelve requestApi para inyectar automáticamente el token Bearer
   * y manejar globalmente los errores 401 (Unauthorized) cerrando la sesión.
   */
  const fetchApi = useCallback(
    async <T,>(path: string, init: RequestInit = {}) => {
      if (!session) throw new Error('No session');
      try {
        return await authenticatedRequest<T>(path, init);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearLegacySession();
          clearSessionMemory();
          setSession(null);
          if (redirectTo) {
            router.replace(redirectTo);
          }
        }
        throw err;
      }
    },
    [session, router, redirectTo],
  );

  /**
   * Revoca la familia en la API, limpia la entrada legada y redirige.
   */
  const logout = useCallback(async () => {
    try { await logoutApi(); } catch { /* Local UI still closes if the cookie has expired. */ }
    clearLegacySession();
    setSession(null);
    router.replace(redirectTo || '/'); // Fallback to '/' if redirectTo is null
  }, [router, redirectTo]);

  const hasRole = useCallback(
    (role: string) => session?.user.roles.includes(role) ?? false,
    [session],
  );

  const isAdmin = hasRole('admin');

  return { session, loading, fetchApi, logout, hasRole, isAdmin };
}
