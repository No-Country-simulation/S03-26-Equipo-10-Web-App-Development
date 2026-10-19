import { describe, expect, it, vi } from 'vitest';
import { memoryBackedStorage } from './preference-storage';
describe('preferencias no sensibles con storage denegado', () => {
  it('conserva valores y permite borrarlos sin acceder al storage bloqueado', () => {
    const storage = memoryBackedStorage(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(storage.get('event')).toBeNull();
    storage.set('event', '1');
    expect(storage.get('event')).toBe('1');
    storage.remove('event');
    expect(storage.get('event')).toBeNull();
  });
  it('una eliminación fallida no resucita el dato anterior', () => {
    const backing = {
      getItem: vi.fn(() => '1'),
      setItem: vi.fn(),
      removeItem: vi.fn(() => {
        throw new Error('quota');
      }),
    } as unknown as Storage;
    const storage = memoryBackedStorage(() => backing);
    expect(storage.get('event')).toBe('1');
    storage.remove('event');
    expect(storage.get('event')).toBeNull();
    storage.set('event', '2');
    expect(storage.get('event')).toBe('2');
  });
});
