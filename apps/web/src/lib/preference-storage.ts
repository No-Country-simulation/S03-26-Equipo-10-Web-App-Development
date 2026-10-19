/** Non-sensitive preferences only. Never use this memory fallback for credentials. */
export function memoryBackedStorage(storage: () => Storage) {
  const memory = new Map<string, string | null>();
  return {
    get(key: string): string | null {
      if (memory.has(key)) return memory.get(key) ?? null;
      try {
        return storage().getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string) {
      memory.set(key, value);
      try {
        storage().setItem(key, value);
      } catch {
        /* The current tab keeps working. */
      }
    },
    remove(key: string) {
      // A tombstone wins over an old value if removeItem is denied.
      memory.set(key, null);
      try {
        storage().removeItem(key);
      } catch {
        /* Keep the tombstone in memory. */
      }
    },
  };
}
export const trackingStorage = memoryBackedStorage(() => window.sessionStorage);
