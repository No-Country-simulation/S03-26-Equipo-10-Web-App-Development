import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import UsersPage from '@/features/users/screens/users-screen';
import ApiKeysPage from '@/features/api-keys/screens/api-keys-screen';
import WebhooksPage from '@/features/webhooks/screens/webhooks-screen';
const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }));
vi.mock('@/hooks/use-session', () => ({
  useSession: () => ({
    session: { user: { id: 'own-admin', roles: ['admin'] } },
    fetchApi,
  }),
}));
beforeEach(() => {
  fetchApi.mockReset();
});
const date = '2026-10-15T00:00:00Z';
it.each([
  {
    Screen: UsersPage,
    resource: 'users',
    record: {
      id: 'synthetic-user',
      tenantId: 'synthetic',
      email: 'editor@example.invalid',
      isActive: true,
      roles: ['editor'],
      createdAt: date,
      updatedAt: date,
    },
    trigger: 'Eliminar usuario editor@example.invalid',
    confirm: 'Eliminar usuario',
    context: 'editor@example.invalid',
  },
  {
    Screen: ApiKeysPage,
    resource: 'api-keys',
    record: {
      id: 'synthetic-key',
      tenantId: 'synthetic',
      name: 'Integración sintética',
      isActive: true,
      status: 'ACTIVE',
      publicId: 'public-id',
      scopes: ['testimonials:read'],
      legacy: false,
      expiresAt: null,
      legacyDeadline: null,
      lastUsedAt: null,
      createdAt: date,
      updatedAt: date,
    },
    trigger: 'Revocar',
    confirm: 'Revocar API key',
    context: 'Integración sintética',
  },
  {
    Screen: WebhooksPage,
    resource: 'webhooks',
    record: {
      id: 'synthetic-webhook',
      tenantId: 'synthetic',
      url: 'https://receiver.example.invalid/events',
      eventCode: 'testimonial.published',
      isActive: true,
      createdAt: date,
      updatedAt: date,
      hasSignature: true,
      signatureGraceUntil: null,
    },
    trigger: 'Archivar webhook https://receiver.example.invalid/events',
    confirm: 'Archivar webhook',
    context: 'receiver.example.invalid',
  },
])(
  '$resource usa la confirmación activa y sólo muta después de confirmar',
  async ({ Screen, resource, record, trigger, confirm, context }) => {
    let removed = false;
    fetchApi.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        removed = true;
        return {
          success: true,
          data: { id: record.id, deleted: true, revoked: true },
        };
      }
      if (path.startsWith('/' + resource + '?'))
        return {
          success: true,
          data:
            removed && resource !== 'webhooks'
              ? []
              : [
                  {
                    ...record,
                    ...(removed && resource === 'webhooks'
                      ? { isActive: false, deletedAt: date }
                      : {}),
                  },
                ],
          meta: {
            page: 1,
            limit: 20,
            total: removed && resource !== 'webhooks' ? 0 : 1,
          },
        };
      throw new Error('Unexpected request');
    });
    render(<Screen />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: trigger }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(context);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(removed).toBe(false);
    await user.click(screen.getByRole('button', { name: trigger }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: confirm,
      }),
    );
    await waitFor(() => expect(removed).toBe(true));
    expect(
      fetchApi.mock.calls.filter(([, init]) => init?.method === 'DELETE'),
    ).toHaveLength(1);
    expect(
      await screen.findByText(
        /Usuario eliminado|API key revocada|Webhook archivado/,
      ),
    ).toBeInTheDocument();
    if (resource === 'webhooks')
      expect(
        screen.getByText('Archivado', { exact: true }),
      ).toBeInTheDocument();
  },
);
