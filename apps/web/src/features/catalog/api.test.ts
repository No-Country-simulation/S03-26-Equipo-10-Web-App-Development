import { expect, it, vi } from 'vitest';
import { deleteCategory, deleteTag, renameCategory, renameTag } from './api';
it.each([deleteCategory, deleteTag])(
  'does not confirm catalog deletion for a different identifier',
  async (remove) => {
    const fetchApi = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'wrong', deleted: true },
    });
    await expect(remove(fetchApi, 'target')).rejects.toThrow();
  },
);
it.each([renameCategory, renameTag])(
  'does not confirm a name different from the requested change',
  async (rename) => {
    const fetchApi = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'target', tenantId: 'tenant', name: 'Previous' },
    });
    await expect(rename(fetchApi, 'target', 'Requested')).rejects.toThrow();
  },
);
