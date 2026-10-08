import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicCapturePage from './capture-screen';
import { ApiError } from '@/lib/api';

const { getFormInfo, submitPublicTestimonial, params } = vi.hoisted(() => ({
  getFormInfo: vi.fn(), submitPublicTestimonial: vi.fn(), params: { slug: 'acme' },
}));

vi.mock('next/navigation', () => ({ useParams: () => params }));
vi.mock('../api', () => ({ getFormInfo, submitPublicTestimonial }));

describe('PublicCapturePage', () => {
  beforeEach(() => {
    params.slug = 'acme';
    getFormInfo.mockReset().mockResolvedValue({ name: 'Acme', isPublicFormEnabled: true, logoUrl: null });
    submitPublicTestimonial.mockReset().mockResolvedValue({ status: 'success', id: 'one', failedMedia: [] });
  });

  it('resets an image failure when navigating to another public slug', async () => {
    getFormInfo.mockResolvedValue({ name: 'Acme', isPublicFormEnabled: true,
      logoUrl: 'https://res.cloudinary.com/synthetic/image/upload/acme.png' });
    const { rerender } = render(<PublicCapturePage />);
    fireEvent.error(await screen.findByRole('img', { name: 'Logo de Acme' }));
    expect(screen.getByRole('img', { name: 'Iniciales de Acme' })).toBeInTheDocument();
    params.slug = 'other';
    rerender(<PublicCapturePage />);
    expect(await screen.findByRole('img', { name: 'Logo de Acme' })).toBeInTheDocument();
    expect(getFormInfo).toHaveBeenLastCalledWith('other');
  });

  it('shows the company logo and keeps the form usable after an image failure', async () => {
    getFormInfo.mockResolvedValueOnce({ name: 'Acme', isPublicFormEnabled: true,
      logoUrl: 'https://res.cloudinary.com/synthetic/image/upload/acme.png' });
    render(<PublicCapturePage />);
    const logo = await screen.findByRole('img', { name: 'Logo de Acme' });
    fireEvent.error(logo);
    expect(screen.getByRole('img', { name: 'Iniciales de Acme' })).toHaveTextContent('A');
    expect(screen.getByRole('textbox', { name: 'Contanos tu historia' })).toBeEnabled();
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

  it('confirms saved text and names both failed media without suggesting resubmission', async () => {
    submitPublicTestimonial.mockResolvedValueOnce({
      status: 'partial', id: 'one', failedMedia: ['image', 'video'],
    });
    const user = userEvent.setup();
    render(<PublicCapturePage />);

    await screen.findByRole('heading', { name: 'Acme' });
    await user.type(screen.getByRole('textbox', { name: 'Contanos tu historia' }), 'Excelente atención del equipo');
    await user.type(screen.getByRole('textbox', { name: 'Tu Nombre Completo' }), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Enviar testimonio' }));

    expect(await screen.findByRole('heading', { name: '¡Muchas gracias!' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No pudimos confirmar el adjunto de la foto y el video');
    expect(screen.getByRole('status')).toHaveTextContent('no vuelvas a enviar el formulario');
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

  it('distinguishes rate limiting from a saved submission', async () => {
    submitPublicTestimonial.mockRejectedValueOnce(new ApiError('rate limit', 'RATE_LIMITED', 429));
    const user = userEvent.setup();
    render(<PublicCapturePage />);

    await screen.findByRole('heading', { name: 'Acme' });
    await user.type(screen.getByRole('textbox', { name: 'Contanos tu historia' }), 'Excelente atención del equipo');
    await user.type(screen.getByRole('textbox', { name: 'Tu Nombre Completo' }), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Enviar testimonio' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Alcanzaste el límite de envíos');
    expect(screen.getByRole('textbox', { name: 'Contanos tu historia' })).toHaveValue('Excelente atención del equipo');
    expect(screen.queryByRole('heading', { name: '¡Muchas gracias!' })).not.toBeInTheDocument();
  });

  it('offers retry after a recoverable form load error', async () => {
    getFormInfo.mockRejectedValueOnce(new Error('network unavailable'));
    const user = userEvent.setup();
    render(<PublicCapturePage />);

    expect(await screen.findByRole('heading', { name: /No se pudo cargar/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Acme' })).toBeInTheDocument();
    expect(getFormInfo).toHaveBeenCalledTimes(2);
  });
});
