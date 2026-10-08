import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from './settings-screen';

const { access, getTenant, listFeatureFlags } = vi.hoisted(() => ({
  access: { isAdmin: true }, getTenant: vi.fn(), listFeatureFlags: vi.fn(),
}));
vi.mock('@/hooks/use-session', () => ({ useSession: () => ({
  session: 'synthetic', fetchApi: getTenant, isAdmin: access.isAdmin,
}) }));
vi.mock('../api', () => ({ getTenant, listFeatureFlags, updateTenant: vi.fn() }));

describe('settings company logo access', () => {
  beforeEach(() => {
    access.isAdmin = true;
    getTenant.mockResolvedValue({ data: { id: 'synthetic', name: 'Acme', logoUrl: null,
      publicSlug: null, isPublicFormEnabled: false, isActive: true, createdAt: '2026-10-08T00:00:00Z' } });
    listFeatureFlags.mockResolvedValue({ data: [] });
  });

  it('shows the logo editor to an administrator', async () => {
    render(<SettingsPage />);
    expect(await screen.findByLabelText('Seleccioná una imagen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar logo' })).toBeDisabled();
  });

  it('keeps the logo editor unavailable to editors', async () => {
    access.isAdmin = false;
    await act(async () => { render(<SettingsPage />); });
    expect(screen.getByText('Acceso restringido a administradores')).toBeInTheDocument();
    expect(screen.queryByLabelText('Seleccioná una imagen')).not.toBeInTheDocument();
  });
});
