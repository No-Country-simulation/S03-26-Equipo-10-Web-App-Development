import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from './settings-screen';
import { ApiError } from '@/lib/api';
import {
  WorkspaceIdentityProvider,
  useWorkspaceIdentity,
} from '@/features/shared/workspace-identity';
function IdentityProbe() {
  const identity = useWorkspaceIdentity();
  return <p aria-label="Identidad confirmada">{identity?.name}</p>;
}

const {
  access,
  getTenant,
  listFeatureFlags,
  updateTenant,
  updateFeatureFlag,
  uploadTenantLogo,
  removeTenantLogo,
} = vi.hoisted(() => ({
  access: { isAdmin: true },
  getTenant: vi.fn(),
  listFeatureFlags: vi.fn(),
  updateTenant: vi.fn(),
  updateFeatureFlag: vi.fn(),
  uploadTenantLogo: vi.fn(),
  removeTenantLogo: vi.fn(),
}));
const tenant = {
  id: 'synthetic',
  name: 'Estudio Ejemplo',
  logoUrl: null,
  publicSlug: 'estudio-ejemplo',
  isPublicFormEnabled: false,
  isActive: true,
  createdAt: '2026-10-08T00:00:00Z',
};
vi.mock('@/hooks/use-session', () => ({
  useSession: () => ({
    session: { user: { tenantId: 'synthetic', tenantName: 'Estudio Ejemplo' } },
    fetchApi: getTenant,
    isAdmin: access.isAdmin,
  }),
}));
vi.mock('../api', () => ({
  getTenant,
  listFeatureFlags,
  updateTenant,
  updateFeatureFlag,
  uploadTenantLogo,
  removeTenantLogo,
}));

describe('independent workspace settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.isAdmin = true;
    getTenant.mockResolvedValue({ data: { ...tenant } });
    listFeatureFlags.mockResolvedValue({
      data: [{ id: 'flag', name: 'enable_analytics', enabled: true }],
    });
    updateTenant.mockImplementation(async (_fetch, input) => ({
      data: { ...tenant, ...input },
    }));
    uploadTenantLogo.mockResolvedValue({
      data: { ...tenant, logoUrl: 'https://images.example.invalid/logo.png' },
    });
    updateFeatureFlag.mockResolvedValue({
      data: {
        flagName: 'enable_analytics',
        enabled: false,
        tenantId: tenant.id,
        updatedAt: '2026-10-18T00:00:00Z',
      },
    });
  });
  it('keeps brand and reception usable when flags fail', async () => {
    listFeatureFlags.mockRejectedValue(new Error('Unavailable'));
    render(<SettingsPage />);
    expect(
      await screen.findByLabelText('Seleccioná una imagen'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del espacio')).toHaveValue(
      tenant.name,
    );
    expect(
      screen.getByRole('button', { name: 'Abrir recepción' }),
    ).toBeEnabled();
    expect(
      await screen.findByRole('button', { name: /Reintentar/ }),
    ).toBeInTheDocument();
  });
  it('preserves a slug draft and confirmed feedback through another save and refresh', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    const slug = await screen.findByLabelText('Identificador del enlace');
    await user.clear(slug);
    await user.type(slug, 'nuevo-enlace');
    await user.click(screen.getByRole('button', { name: 'Abrir recepción' }));
    expect(await screen.findByText('Recepción abierta.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Refrescar' }));
    await waitFor(() => expect(getTenant).toHaveBeenCalledTimes(2));
    expect(slug).toHaveValue('nuevo-enlace');
    expect(screen.getByText('Recepción abierta.')).toBeInTheDocument();
  });
  it('merges concurrent confirmations only into their own fields', async () => {
    let finishName!: (value: unknown) => void;
    updateTenant.mockImplementation((_fetch, input) =>
      input.name
        ? new Promise((resolve) => {
            finishName = resolve;
          })
        : Promise.resolve({ data: { ...tenant, ...input } }),
    );
    const user = userEvent.setup();
    render(<SettingsPage />);
    const name = await screen.findByLabelText('Nombre del espacio');
    await user.clear(name);
    await user.type(name, 'Nombre confirmado');
    await user.click(screen.getByRole('button', { name: 'Guardar nombre' }));
    await user.click(screen.getByRole('button', { name: 'Abrir recepción' }));
    expect(await screen.findByText('Recepción abierta.')).toBeInTheDocument();
    await act(async () => {
      finishName({ data: { ...tenant, name: 'Nombre confirmado' } });
    });
    expect(
      await screen.findByRole('button', { name: 'Cerrar recepción' }),
    ).toBeEnabled();
    expect(name).toHaveValue('Nombre confirmado');
    await act(async () => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    });
    expect(
      screen.getByRole('button', { name: 'Cerrar recepción' }),
    ).toHaveFocus();
  });
  it('edits technical parameters without claiming they control access', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(
      await screen.findByRole('button', {
        name: 'Desactivar parámetro Analítica',
      }),
    );
    await waitFor(() =>
      expect(updateFeatureFlag).toHaveBeenCalledWith(
        getTenant,
        'enable_analytics',
        false,
        tenant.id,
      ),
    );
    expect(
      screen.getByRole('button', { name: 'Activar parámetro Analítica' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no controla el acceso a Analítica/),
    ).toBeInTheDocument();
  });
  it('ignores an obsolete refresh that resolves after a reception write', async () => {
    let finishRead!: (value: unknown) => void;
    const user = userEvent.setup();
    render(<SettingsPage />);
    await screen.findByLabelText('Nombre del espacio');
    getTenant.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRead = resolve;
        }),
    );
    await user.click(screen.getByRole('button', { name: 'Refrescar' }));
    await user.click(screen.getByRole('button', { name: 'Abrir recepción' }));
    expect(await screen.findByText('Recepción abierta.')).toBeInTheDocument();
    await act(async () => {
      finishRead({ data: { ...tenant } });
    });
    expect(
      screen.getByRole('button', { name: 'Cerrar recepción' }),
    ).toBeEnabled();
  });
  it('preserves logo feedback and the slug draft when refreshing without remounting the editor', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    const slug = await screen.findByLabelText('Identificador del enlace');
    await user.clear(slug);
    await user.type(slug, 'borrador-preservado');
    await user.upload(
      screen.getByLabelText('Seleccioná una imagen'),
      new File(['synthetic'], 'logo.png', { type: 'image/png' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Guardar logo' }),
    );
    const feedback = await screen.findByText(/Logo guardado/);
    await waitFor(() => expect(feedback).toHaveFocus());
    await user.click(screen.getByRole('button', { name: 'Refrescar' }));
    await waitFor(() => expect(getTenant).toHaveBeenCalledTimes(2));
    expect(feedback).toBeInTheDocument();
    expect(slug).toHaveValue('borrador-preservado');
    expect(screen.getByRole('button', { name: 'Refrescar' })).toHaveFocus();
  });
  it('does not promise new submissions when reception is open without a slug', async () => {
    getTenant.mockResolvedValue({
      data: { ...tenant, publicSlug: null, isPublicFormEnabled: true },
    });
    render(<SettingsPage />);
    expect(
      await screen.findByText(
        /Configurá un enlace para poder recibir nuevos envíos\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        /Se aceptan nuevos envíos por el enlace configurado\./,
      ),
    ).not.toBeInTheDocument();
  });
  it('refreshes confirmed shell identity without replacing an unsaved name', async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceIdentityProvider name="Nombre de sesión">
        <IdentityProbe />
        <SettingsPage />
      </WorkspaceIdentityProvider>,
    );
    const name = await screen.findByLabelText('Nombre del espacio');
    await user.clear(name);
    await user.type(name, 'Borrador de nombre');
    getTenant.mockResolvedValue({
      data: { ...tenant, name: 'Actualizado en servidor' },
    });
    await user.click(screen.getByRole('button', { name: 'Refrescar' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Identidad confirmada')).toHaveTextContent(
        'Actualizado en servidor',
      ),
    );
    expect(name).toHaveValue('Borrador de nombre');
  });
  it('keeps flag controls available when tenant metadata fails', async () => {
    getTenant.mockRejectedValue(new Error('Unavailable'));
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(
      await screen.findByRole('button', {
        name: 'Desactivar parámetro Analítica',
      }),
    );
    expect(
      await screen.findByRole('button', {
        name: 'Activar parámetro Analítica',
      }),
    ).toBeEnabled();
  });
  it('retains a conflicting name draft and lets reception save independently', async () => {
    updateTenant.mockImplementation(async (_fetch, input) => {
      if (input.name) throw new ApiError('Conflict', 'CONFLICT', 409);
      return { data: { ...tenant, ...input } };
    });
    const user = userEvent.setup();
    render(<SettingsPage />);
    const name = await screen.findByLabelText('Nombre del espacio');
    await user.clear(name);
    await user.type(name, 'Nombre ocupado');
    await user.click(screen.getByRole('button', { name: 'Guardar nombre' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'hay un conflicto',
    );
    expect(name).toHaveValue('Nombre ocupado');
    await user.click(screen.getByRole('button', { name: 'Abrir recepción' }));
    expect(await screen.findByText('Recepción abierta.')).toBeInTheDocument();
    expect(name).toHaveValue('Nombre ocupado');
  });
  it('does not change a flag value when its mutation fails', async () => {
    updateFeatureFlag.mockRejectedValue(
      new ApiError('Unavailable', 'UNAVAILABLE', 503),
    );
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(
      await screen.findByRole('button', {
        name: 'Desactivar parámetro Analítica',
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos confirmar',
    );
    expect(
      screen.getByRole('button', { name: 'Desactivar parámetro Analítica' }),
    ).toBeEnabled();
  });
  it('returns focus to the edited field after its save button becomes disabled', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    const name = await screen.findByLabelText('Nombre del espacio');
    await user.clear(name);
    await user.type(name, 'Nombre nuevo');
    await user.click(screen.getByRole('button', { name: 'Guardar nombre' }));
    await screen.findByText('Nombre guardado.');
    await waitFor(() => expect(name).toHaveFocus());
  });
  it('does not fetch administrative resources for an editor', async () => {
    access.isAdmin = false;
    await act(async () => {
      render(<SettingsPage />);
    });
    expect(
      screen.getByText('Acceso restringido a administradores'),
    ).toBeInTheDocument();
    expect(getTenant).not.toHaveBeenCalled();
    expect(listFeatureFlags).not.toHaveBeenCalled();
  });
  it('focuses a linked section after asynchronous tenant loading, without jumping again on refresh', async () => {
    const previousUrl = window.location.href;
    const originalScroll = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView',
    );
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scroll,
    });
    window.history.replaceState(null, '', '/admin/settings#integrations');
    try {
      const user = userEvent.setup();
      render(<SettingsPage />);
      const section = await screen.findByRole('region', {
        name: 'Integraciones',
      });
      await waitFor(() => expect(section).toHaveFocus());
      expect(scroll).toHaveBeenCalledTimes(1);
      await user.click(screen.getByRole('button', { name: /^Refrescar$/ }));
      await waitFor(() => expect(getTenant).toHaveBeenCalledTimes(2));
      expect(scroll).toHaveBeenCalledTimes(1);
    } finally {
      window.history.replaceState(null, '', previousUrl);
      if (originalScroll)
        Object.defineProperty(
          HTMLElement.prototype,
          'scrollIntoView',
          originalScroll,
        );
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    }
  });
});
