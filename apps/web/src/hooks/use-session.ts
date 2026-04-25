'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SessionPayload, requestApi, ApiError } from '@/lib/api';
import { getStoredSession, saveSession, clearSession } from '@/lib/session-store';

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
    const stored = getStoredSession();
    if (!stored) {
      setLoading(false);
      if (redirectTo) {
        router.replace(redirectTo);
      }
      return;
    }
    setSession(stored);
    setLoading(false);
  }, [redirectTo, router]);

  const authHeaders = useCallback(() => {
    if (!session) return {};
    return { Authorization: `Bearer ${session.tokens.accessToken}` };
  }, [session]);

  /**
   * Envuelve requestApi para inyectar automáticamente el token Bearer
   * y manejar globalmente los errores 401 (Unauthorized) cerrando la sesión.
   */
  const fetchApi = useCallback(
    async <T,>(path: string, init: RequestInit = {}) => {
      if (!session) throw new Error('No session');
      try {
        return await requestApi<T>(path, {
          ...init,
          headers: { ...authHeaders(), ...(init.headers ?? {}) } as Record<string, string>,
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          setSession(null);
          if (redirectTo) {
            router.replace(redirectTo);
          }
        }
        throw err;
      }
    },
    [session, authHeaders, router, redirectTo],
  );

  /**
   * Cierra la sesión en el cliente (limpia localStorage) y redirige.
   */
  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    router.replace(redirectTo || '/'); // Fallback to '/' if redirectTo is null
  }, [router, redirectTo]);

  const hasRole = useCallback(
    (role: string) => session?.user.roles.includes(role) ?? false,
    [session],
  );

  const isAdmin = hasRole('admin');

  return { session, loading, fetchApi, logout, hasRole, isAdmin, authHeaders };
}
