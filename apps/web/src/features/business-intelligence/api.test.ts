import { describe, expect, it, vi } from 'vitest';
import { getBiDashboard } from './api';
import type { SessionFetch } from '@/lib/api/validated-response';

describe('BI API response boundary', () => {
  it('rejects numeric engagement counts and malformed responses without rounding them', async () => {
    const fetchApi = vi.fn().mockResolvedValue({ success: true, data: { summary: { views: 9007199254740993 } } });
    await expect(getBiDashboard(fetchApi as SessionFetch, { from: '2024-02-29', to: '2024-03-01' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(fetchApi).toHaveBeenCalledWith('/bi/dashboard?from=2024-02-29&to=2024-03-01', undefined);
  });
});
