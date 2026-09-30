import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicCapturePage from './capture-screen';

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
    await user.type(screen.getByPlaceholderText(/¿Qué es lo que más te gustó/), 'Excelente atención del equipo');
    await user.type(screen.getByPlaceholderText('Ej. Juan Pérez'), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Enviar Testimonio' }));

    await waitFor(() => expect(submitPublicTestimonial).toHaveBeenCalledWith('acme', expect.objectContaining({
      authorName: 'Ana', content: 'Excelente atención del equipo', rating: 5,
    })));
    expect(await screen.findByRole('heading', { name: '¡Muchas Gracias!' })).toBeInTheDocument();
  });
});
