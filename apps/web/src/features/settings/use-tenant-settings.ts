'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionFetch } from '@/lib/api/validated-response';
import { ApiError } from '@/lib/api';
import { getTenant, type TenantInfo } from './api';

/** Retains mounted editors and ignores reads begun before a confirmed write. */
export function useTenantSettings(fetchApi: SessionFetch, tenantId: string) {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [writes, setWrites] = useState(0);
  const revision = useRef(0);
  const pending = useRef(0);
  const alive = useRef(true);
  const reload = useCallback(async () => {
    if (pending.current) return;
    const version = ++revision.current;
    setLoading(true);
    setError(null);
    try {
      const response = await getTenant(fetchApi);
      if (response.data.id !== tenantId)
        throw new ApiError('Respuesta de otro espacio.', 'INVALID_RESPONSE');
      if (alive.current && revision.current === version)
        setTenant(response.data);
    } catch (failure) {
      if (alive.current && revision.current === version) setError(failure);
    } finally {
      if (alive.current && revision.current === version) setLoading(false);
    }
  }, [fetchApi, tenantId]);
  const invalidateRead = useCallback(() => {
    revision.current++;
  }, []);
  useEffect(() => {
    alive.current = true;
    void reload();
    return () => {
      alive.current = false;
      invalidateRead();
    };
  }, [reload, invalidateRead]);
  function beginWrite() {
    revision.current++;
    pending.current++;
    setWrites(pending.current);
    setLoading(false);
  }
  function endWrite() {
    pending.current--;
    if (alive.current) setWrites(pending.current);
  }
  function merge(response: TenantInfo, fields: (keyof TenantInfo)[]) {
    if (response.id !== tenantId)
      throw new ApiError('Respuesta de otro espacio.', 'INVALID_RESPONSE');
    revision.current++;
    if (alive.current)
      setTenant((current) =>
        current
          ? {
              ...current,
              ...Object.fromEntries(
                fields.map((field) => [field, response[field]]),
              ),
            }
          : response,
      );
  }
  return {
    tenant,
    error,
    loading,
    writes,
    reload,
    beginWrite,
    endWrite,
    merge,
  };
}
