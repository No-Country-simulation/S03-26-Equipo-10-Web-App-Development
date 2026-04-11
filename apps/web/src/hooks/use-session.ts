'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SessionPayload, requestApi, ApiError } from '@/lib/api';
import { getStoredSession, saveSession, clearSession } from '@/lib/session-store';

export function useSession({ redirectTo = '/admin/login' }: { redirectTo?: string } = {}) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = getStoredSession();
    if (!stored) {
      setLoading(false);
      router.replace(redirectTo);
      return;
    }
    setSession(stored);
    setLoading(false);
  }, [redirectTo, router]);

  const authHeaders = useCallback(() => {
    if (!session) return {};
    return { Authorization: `Bearer ${session.tokens.accessToken}` };
  }, [session]);

  const fetchApi = useCallback(
    async <T,>(path: string, init: RequestInit = {}) => {
      if (!session) throw new Error('No session');
      try {
        return await requestApi<T>(path, {
          ...init,
          headers: { ...authHeaders(), ...(init.headers ?? {}) },
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          setSession(null);
          router.replace(redirectTo);
        }
        throw err;
      }
    },
    [session, authHeaders, router, redirectTo],
  );

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    router.replace(redirectTo);
  }, [router, redirectTo]);

  const hasRole = useCallback(
    (role: string) => session?.user.roles.includes(role) ?? false,
    [session],
  );

  const isAdmin = hasRole('admin');

  return { session, loading, fetchApi, logout, hasRole, isAdmin, authHeaders };
}
