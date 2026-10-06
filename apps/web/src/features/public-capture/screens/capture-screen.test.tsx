import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicCapturePage from './capture-screen';
import { ApiError } from '@/lib/api';

const { getFormInfo, submitPublicTestimonial } = vi.hoisted(() => ({
  getFormInfo: vi.fn(), submitPublicTestimonial: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useParams: () => ({ slug: 'acme' }) }));
vi.mock('../api', () => ({ getFormInfo, submitPublicTestimonial }));

describe('PublicCapturePage', () => {
  beforeEach(() => {
    getFormInfo.mockReset().mockResolvedValue({ name: 'Acme', isPublicFormEnabled: true });
    submitPublicTestimonial.mockReset().mockResolvedValue({ status: 'success', id: 'one' });
  });

  it('keeps the public form and success flow', async () => {
    const user = userEvent.setup();
    render(<PublicCapturePage />);

    expect(await screen.findByRole('heading', { name: 'Acme' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Contanos tu historia' }), 'Excelente atención del equipo');
    await user.type(screen.getByRole('textbox', { name: 'Tu Nombre Completo' }), 'Ana');
    await user.click(screen.getByRole('radio', { name: '4 estrellas' }));
    expect(screen.getByRole('radio', { name: '4 estrellas' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Enviar testimonio' }));

    await waitFor(() => expect(submitPublicTestimonial).toHaveBeenCalledWith('acme', expect.objectContaining({
      authorName: 'Ana', content: 'Excelente atención del equipo', rating: 4,
    })));
    expect(await screen.findByRole('heading', { name: '¡Muchas gracias!' })).toBeInTheDocument();
  });

  it('keeps the entered data and reports a suppressed submission without success', async () => {
    submitPublicTestimonial.mockRejectedValueOnce(new ApiError('recent', 'PUBLIC_SUBMISSION_RECENT_BROWSER', 409));
    const user = userEvent.setup();
    render(<PublicCapturePage />);

    await screen.findByRole('heading', { name: 'Acme' });
    await user.type(screen.getByRole('textbox', { name: 'Contanos tu historia' }), 'Excelente atención del equipo');
    await user.type(screen.getByRole('textbox', { name: 'Tu Nombre Completo' }), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Enviar testimonio' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Este intento no se guardó');
    expect(screen.getByRole('textbox', { name: 'Contanos tu historia' })).toHaveValue('Excelente atención del equipo');
    expect(screen.queryByRole('heading', { name: '¡Muchas gracias!' })).not.toBeInTheDocument();
  });
});
