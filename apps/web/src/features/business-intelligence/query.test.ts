import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseBiQuery } from './query';

describe('BI query parsing with transformed pagination', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('returns numeric page defaults and the default UTC date range', () => {
    expect(parseBiQuery(new URLSearchParams())).toEqual({
      error: null,
      query: {
        view: 'summary',
        page: 1,
        requestPage: 1,
        from: '2026-09-26',
        to: '2026-10-25',
      },
    });
  });

  it('transforms explicit page strings and preserves a valid leap-day range', () => {
    expect(
      parseBiQuery(
        new URLSearchParams(
          'view=runs&page=10000&requestPage=2&from=2024-02-29&to=2024-03-01',
        ),
      ),
    ).toEqual({
      error: null,
      query: {
        view: 'runs',
        page: 10000,
        requestPage: 2,
        from: '2024-02-29',
        to: '2024-03-01',
      },
    });
  });

  it.each(['', '0', '-1', '1.5', '1e2', '10001', '9007199254740993', 'abc'])(
    'rejects invalid pagination %j for either list',
    (value) => {
      for (const key of ['page', 'requestPage']) {
        const result = parseBiQuery(new URLSearchParams({ [key]: value }));
        expect(result.query).toBeNull();
        expect(result.error).toBe(
          'Los filtros del enlace no son válidos. Restablecé la vista.',
        );
      }
    },
  );

  it('rejects an impossible calendar day', () => {
    expect(
      parseBiQuery(new URLSearchParams('from=2024-02-30&to=2024-03-01')).query,
    ).toBeNull();
  });
});
