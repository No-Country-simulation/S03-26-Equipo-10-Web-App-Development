'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { listPublicTestimonials, type PublicTestimonial } from './api';

type Gallery = {
  items: PublicTestimonial[];
  meta: { page: number; limit: number; total: number };
  focusId: string | null;
};
export function usePublicGallery(slug: string) {
  const [data, setData] = useState<Gallery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const requestVersion = useRef(0),
    lock = useRef(false),
    controller = useRef<AbortController | null>(null);
  const load = useCallback(
    async (page: number) => {
      if (lock.current) return;
      lock.current = true;
      const version = ++requestVersion.current;
      controller.current = new AbortController();
      setLoading(true);
      setError(null);
      try {
        const response = await listPublicTestimonials(
          slug,
          page,
          controller.current.signal,
        );
        if (version !== requestVersion.current) return;
        setData((current) => {
          const prior = page === 1 ? [] : (current?.items ?? []),
            ids = new Set(prior.map((item) => item.id));
          const added = response.items.filter((item) => !ids.has(item.id));
          return {
            items: [...prior, ...added],
            meta: response.meta,
            focusId: page > 1 ? (added[0]?.id ?? '') : null,
          };
        });
      } catch (failure) {
        if (version === requestVersion.current) setError(failure);
      } finally {
        if (version === requestVersion.current) {
          lock.current = false;
          setLoading(false);
        }
      }
    },
    [slug],
  );
  const cancel = useCallback(() => {
    requestVersion.current++;
    controller.current?.abort();
    lock.current = false;
  }, []);
  useEffect(() => {
    void load(1);
    return cancel;
  }, [load, cancel]);
  return {
    data,
    loading,
    error,
    loadNext: () => void load(data ? data.meta.page + 1 : 1),
  };
}
