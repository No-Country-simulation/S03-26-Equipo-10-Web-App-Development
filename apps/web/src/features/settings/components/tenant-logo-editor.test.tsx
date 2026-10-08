import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantLogoEditor } from './tenant-logo-editor';
import { ApiError } from '@/lib/api';
import type { SessionFetch } from '@/lib/api/validated-response';

const { upload, remove } = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn() }));
vi.mock('../api', () => ({ uploadTenantLogo: upload, removeTenantLogo: remove }));
const logo = 'https://res.cloudinary.com/demo/image/upload/saved.png';

describe('company logo editor', () => {
  const fetchApi = vi.fn() as SessionFetch;
  const onSaved = vi.fn();
  const props = { tenantId: 'synthetic', name: 'Acme', logoUrl: logo, fetchApi, onSaved };
  beforeEach(() => {
    vi.clearAllMocks();
    upload.mockResolvedValue({ data: { logoUrl: logo } });
    remove.mockResolvedValue({ data: { logoUrl: null } });
  });

  it('previews and saves a selected image, then removes the visible logo', async () => {
    const user = userEvent.setup();
    render(<TenantLogoEditor {...props} />);
    await user.upload(screen.getByLabelText('Seleccioná una imagen'), new File(['synthetic'], 'logo.png', { type: 'image/png' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar logo' })).toBeEnabled());
    expect(screen.getByRole('img', { name: 'Logo de Acme' }).getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    await user.click(screen.getByRole('button', { name: 'Guardar logo' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Logo guardado');
    expect(upload).toHaveBeenCalledWith(fetchApi, expect.stringMatching(/^data:image\/png;base64,/));
    await user.click(screen.getByRole('button', { name: 'Eliminar logo' }));
    expect(await screen.findByRole('img', { name: 'Iniciales de Acme' })).toBeInTheDocument();
    expect(remove).toHaveBeenCalledWith(fetchApi);
    expect(onSaved).toHaveBeenCalledTimes(2);
  });

  it('rejects unsupported and oversized files without calling the backend', () => {
    render(<TenantLogoEditor {...props} />);
    const input = screen.getByLabelText('Seleccioná una imagen');
    for (const file of [new File(['svg'], 'logo.svg', { type: 'image/svg+xml' }),
      new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })]) {
      fireEvent.change(input, { target: { files: [file] } });
      expect(screen.getByRole('alert')).toHaveTextContent('hasta 2 MiB');
      expect(screen.getByRole('button', { name: 'Guardar logo' })).toBeDisabled();
    }
    expect(upload).not.toHaveBeenCalled();
  });

  it('keeps the selection and previous logo on provider failure and allows a retry', async () => {
    upload.mockRejectedValueOnce(new ApiError('Unavailable', 'MEDIA_STORAGE_UNAVAILABLE', 503));
    const user = userEvent.setup();
    render(<TenantLogoEditor {...props} />);
    await user.upload(screen.getByLabelText('Seleccioná una imagen'), new File(['synthetic'], 'logo.webp', { type: 'image/webp' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar logo' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Guardar logo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Conservamos tu selección');
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Eliminar logo' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Guardar logo' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Logo guardado');
  });
});
