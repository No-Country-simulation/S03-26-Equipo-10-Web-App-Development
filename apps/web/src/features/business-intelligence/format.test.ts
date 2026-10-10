import { describe, expect, it } from 'vitest';
import { timestamp } from './format';

describe('BI UTC timestamps', () => {
  it('distinguishes midnight from noon with an explicit 24-hour cycle', () => {
    expect(timestamp('2026-10-10T00:52:15.000Z')).toContain('00:52:15');
    expect(timestamp('2026-10-10T12:52:15.000Z')).toContain('12:52:15');
  });
  it('uses the UTC day across offsets and preserves a missing instant', () => {
    expect(timestamp('2026-10-09T21:52:15-03:00')).toContain('10/10/2026');
    expect(timestamp('2026-10-09T21:52:15-03:00')).toContain('00:52:15');
    expect(timestamp(null)).toBe('Sin datos');
  });
});
