import { CacheService } from '../src/common/services/cache.service';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService();
  });

  it('returns null for missing keys', () => {
    expect(cache.get('missing')).toBeNull();
  });

  it('stores and retrieves values', () => {
    cache.set('key', { data: 42 });
    expect(cache.get('key')).toEqual({ data: 42 });
  });

  it('expires entries after TTL', async () => {
    cache.set('fast', 'value', 50); // 50ms TTL
    expect(cache.get('fast')).toBe('value');

    await new Promise(r => setTimeout(r, 60));
    expect(cache.get('fast')).toBeNull();
  });

  it('getOrSet caches factory result', async () => {
    const factory = jest.fn().mockResolvedValue('computed');

    const first = await cache.getOrSet('key', factory);
    const second = await cache.getOrSet('key', factory);

    expect(first).toBe('computed');
    expect(second).toBe('computed');
    expect(factory).toHaveBeenCalledTimes(1); // Only called once
  });

  it('invalidates a specific key', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.invalidate('a');

    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe(2);
  });

  it('invalidates by prefix', () => {
    cache.set('public:tenant-1:page1', 'data1');
    cache.set('public:tenant-1:page2', 'data2');
    cache.set('public:tenant-2:page1', 'data3');

    cache.invalidateByPrefix('public:tenant-1:');

    expect(cache.get('public:tenant-1:page1')).toBeNull();
    expect(cache.get('public:tenant-1:page2')).toBeNull();
    expect(cache.get('public:tenant-2:page1')).toBe('data3');
  });

  it('clears all entries', () => {
    cache.set('x', 1);
    cache.set('y', 2);
    cache.clear();

    expect(cache.get('x')).toBeNull();
    expect(cache.get('y')).toBeNull();
  });
});
