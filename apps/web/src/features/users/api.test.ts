import { expect, it, vi } from 'vitest';
import { deleteUser, setUserActive } from './api';
const user = {
  id: 'other',
  tenantId: 'tenant',
  email: 'synthetic@example.invalid',
  roles: ['editor'],
  isActive: true,
  createdAt: '2026-10-17',
  updatedAt: '2026-10-17',
};
it.each([
  { ...user, isActive: true },
  { ...user, id: 'different', isActive: false },
])(
  'rejects a response that does not confirm the requested account and access',
  async (record) => {
    const fetchApi = vi.fn().mockResolvedValue({ success: true, data: record });
    await expect(setUserActive(fetchApi, 'other', false)).rejects.toThrow();
    expect(fetchApi).toHaveBeenCalledWith(
      '/users/other',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      }),
    );
  },
);

it('does not confirm deletion without an explicit matching successful result', async () => {
  const fetchApi = vi.fn().mockResolvedValue({
    success: true,
    data: { id: 'other', deleted: false },
  });
  await expect(deleteUser(fetchApi, 'other')).rejects.toThrow();
});
