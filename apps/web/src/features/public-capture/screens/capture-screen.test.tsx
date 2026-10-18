import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PublicCapturePage from './capture-screen';
import { ApiError } from '@/lib/api';

const { getFormInfo, submitPublicTestimonial, params } = vi.hoisted(() => ({
  getFormInfo: vi.fn(),
  submitPublicTestimonial: vi.fn(),
  params: { slug: 'acme' },
}));

vi.mock('next/navigation', () => ({ useParams: () => params }));
vi.mock('../api', () => ({ getFormInfo, submitPublicTestimonial }));

describe('PublicCapturePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    params.slug = 'acme';
    getFormInfo.mockReset().mockResolvedValue({
      name: 'Acme',
      isPublicFormEnabled: true,
      logoUrl: null,
    });
    submitPublicTestimonial
      .mockReset()
      .mockResolvedValue({ status: 'success', id: 'one', failedMedia: [] });
  });

  it('resets an image failure when navigating to another public slug', async () => {
    getFormInfo.mockResolvedValue({
      name: 'Acme',
      isPublicFormEnabled: true,
      logoUrl: 'https://res.cloudinary.com/synthetic/image/upload/acme.png',
    });
    const { rerender } = render(<PublicCapturePage />);
    fireEvent.error(await screen.findByRole('img', { name: 'Logo de Acme' }));
    expect(
      screen.getByRole('img', { name: 'Iniciales de Acme' }),
    ).toBeInTheDocument();
    params.slug = 'other';
    rerender(<PublicCapturePage />);
    expect(
      await screen.findByRole('img', { name: 'Logo de Acme' }),
    ).toBeInTheDocument();
    expect(getFormInfo).toHaveBeenLastCalledWith('other');
  });

  it('shows the company logo and keeps the form usable after an image failure', async () => {
    getFormInfo.mockResolvedValueOnce({
      name: 'Acme',
      isPublicFormEnabled: true,
      logoUrl: 'https://res.cloudinary.com/synthetic/image/upload/acme.png',
    });
    render(<PublicCapturePage />);
    const logo = await screen.findByRole('img', { name: 'Logo de Acme' });
    fireEvent.error(logo);
    expect(
      screen.getByRole('img', { name: 'Iniciales de Acme' }),
    ).toHaveTextContent('A');
    expect(
      screen.getByRole('textbox', { name: 'Contanos tu historia' }),
    ).toBeEnabled();
  });

  it('keeps the public form and success flow', async () => {
    const user = userEvent.setup();
    render(<PublicCapturePage />);

    expect(
      await screen.findByRole('heading', { name: 'Acme' }),
    ).toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: 'Contanos tu historia' }),
      'Excelente atención del equipo',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Tu Nombre Completo' }),
      'Ana',
    );
    await user.click(screen.getByRole('radio', { name: '4 estrellas' }));
    expect(screen.getByRole('radio', { name: '4 estrellas' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: '4 estrellas' }));
    await user.click(screen.getByRole('button', { name: 'Enviar testimonio' }));

    await waitFor(() =>
      expect(submitPublicTestimonial).toHaveBeenCalledWith(
        'acme',
        expect.objectContaining({
          authorName: 'Ana',
          content: 'Excelente atención del equipo',
          rating: 4,
        }),
      ),
    );
    expect(
      await screen.findByRole('heading', { name: '¡Muchas gracias!' }),
    ).toBeInTheDocument();
  });

  it('confirms saved text and names both failed media without suggesting resubmission', async () => {
    submitPublicTestimonial.mockResolvedValueOnce({
      status: 'partial',
      id: 'one',
      failedMedia: ['image', 'video'],
    });
    const user = userEvent.setup();
    render(<PublicCapturePage />);

    await screen.findByRole('heading', { name: 'Acme' });
    await user.type(
      screen.getByRole('textbox', { name: 'Contanos tu historia' }),
      'Excelente atención del equipo',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Tu Nombre Completo' }),
      'Ana',
    );
    await user.click(screen.getByRole('radio', { name: '4 estrellas' }));
    await user.click(screen.getByRole('button', { name: 'Enviar testimonio' }));

    expect(
      await screen.findByRole('heading', { name: '¡Muchas gracias!' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'No pudimos confirmar el adjunto de la foto y el video',
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'no vuelvas a enviar el formulario',
    );
  });

  it('keeps the entered data and reports a suppressed submission without success', async () => {
    submitPublicTestimonial.mockRejectedValueOnce(
      new ApiError('recent', 'PUBLIC_SUBMISSION_RECENT_BROWSER', 409),
    );
    const user = userEvent.setup();
    render(<PublicCapturePage />);

    await screen.findByRole('heading', { name: 'Acme' });
    await user.type(
      screen.getByRole('textbox', { name: 'Contanos tu historia' }),
      'Excelente atención del equipo',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Tu Nombre Completo' }),
      'Ana',
    );
    await user.click(screen.getByRole('radio', { name: '4 estrellas' }));
    await user.click(screen.getByRole('button', { name: 'Enviar testimonio' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este intento no se guardó',
    );
    expect(
      screen.getByRole('textbox', { name: 'Contanos tu historia' }),
    ).toHaveValue('Excelente atención del equipo');
    expect(
      screen.queryByRole('heading', { name: '¡Muchas gracias!' }),
    ).not.toBeInTheDocument();
  });

  it('distinguishes rate limiting from a saved submission', async () => {
    submitPublicTestimonial.mockRejectedValueOnce(
      new ApiError('rate limit', 'RATE_LIMITED', 429),
    );
    const user = userEvent.setup();
    render(<PublicCapturePage />);

    await screen.findByRole('heading', { name: 'Acme' });
    await user.type(
      screen.getByRole('textbox', { name: 'Contanos tu historia' }),
      'Excelente atención del equipo',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Tu Nombre Completo' }),
      'Ana',
    );
    await user.click(screen.getByRole('radio', { name: '4 estrellas' }));
    await user.click(screen.getByRole('button', { name: 'Enviar testimonio' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Alcanzaste el límite de envíos',
    );
    expect(
      screen.getByRole('textbox', { name: 'Contanos tu historia' }),
    ).toHaveValue('Excelente atención del equipo');
    expect(
      screen.queryByRole('heading', { name: '¡Muchas gracias!' }),
    ).not.toBeInTheDocument();
  });

  it('requires a deliberate rating instead of preselecting five stars', async () => {
    const user = userEvent.setup();
    render(<PublicCapturePage />);
    await screen.findByRole('heading', { name: 'Acme' });
    expect(
      screen
        .getAllByRole('radio')
        .every((input) => !(input as HTMLInputElement).checked),
    ).toBe(true);
    await user.type(
      screen.getByLabelText('Contanos tu historia'),
      'Experiencia sintética para revisar',
    );
    await user.type(
      screen.getByLabelText('Tu Nombre Completo'),
      'Persona sintética',
    );
    await user.click(screen.getByRole('button', { name: 'Enviar testimonio' }));
    expect(submitPublicTestimonial).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Elegí una calificación',
    );
  });
  it('explains attachment limits before selection and does not submit twice', async () => {
    let finish!: (value: unknown) => void;
    submitPublicTestimonial.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<PublicCapturePage />);
    await screen.findByRole('heading', { name: 'Acme' });
    expect(screen.getByText(/PNG, JPEG o WebP.*10 MiB/)).toBeInTheDocument();
    await user.type(
      screen.getByLabelText('Contanos tu historia'),
      'Experiencia sintética para revisar',
    );
    await user.type(
      screen.getByLabelText('Tu Nombre Completo'),
      'Persona sintética',
    );
    await user.click(screen.getByRole('radio', { name: '3 estrellas' }));
    const form = screen.getByLabelText('Contanos tu historia').closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(submitPublicTestimonial).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Contanos tu historia')).toHaveAttribute(
      'readonly',
    );
    await act(async () => {
      finish({ status: 'partial', id: 'saved', failedMedia: ['image'] });
    });
    expect(
      await screen.findByRole('heading', { name: '¡Muchas gracias!' }),
    ).toHaveFocus();
    expect(
      screen.queryByRole('button', { name: 'Enviar testimonio' }),
    ).not.toBeInTheDocument();
  });
  it('offers retry after a recoverable form load error', async () => {
    getFormInfo.mockRejectedValueOnce(new Error('network unavailable'));
    const user = userEvent.setup();
    render(<PublicCapturePage />);

    expect(
      await screen.findByRole('heading', { name: /No se pudo cargar/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByRole('heading', { name: 'Acme' }),
    ).toBeInTheDocument();
    expect(getFormInfo).toHaveBeenCalledTimes(2);
  });

  it('rejects unsupported photos without losing text and allows an explicit removal', async () => {
    const user = userEvent.setup();
    render(<PublicCapturePage />);
    await screen.findByRole('heading', { name: 'Acme' });
    await user.type(
      screen.getByLabelText('Contanos tu historia'),
      'Contenido sintético conservado',
    );
    fireEvent.change(screen.getByLabelText('Foto (opcional)'), {
      target: {
        files: [
          new File(['synthetic'], 'unsafe.svg', { type: 'image/svg+xml' }),
        ],
      },
    });
    expect(await screen.findByText(/Elegí una foto PNG/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quitar foto' }));
    expect(screen.queryByText(/Elegí una foto PNG/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Contanos tu historia')).toHaveValue(
      'Contenido sintético conservado',
    );
  });
  it('waits for the selected photo before submitting its content', async () => {
    const readers: Reader[] = [];
    class Reader {
      static LOADING = 1;
      readyState = 0;
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        readers.push(this);
      }
      readAsDataURL() {
        this.readyState = 1;
      }
      abort() {
        this.readyState = 2;
      }
    }
    vi.stubGlobal('FileReader', Reader);
    const user = userEvent.setup();
    render(<PublicCapturePage />);
    await screen.findByRole('heading', { name: 'Acme' });
    await user.type(
      screen.getByLabelText('Contanos tu historia'),
      'Contenido sintético con una foto',
    );
    await user.type(
      screen.getByLabelText('Tu Nombre Completo'),
      'Persona sintética',
    );
    await user.click(screen.getByRole('radio', { name: '4 estrellas' }));
    fireEvent.change(screen.getByLabelText('Foto (opcional)'), {
      target: {
        files: [new File(['synthetic'], 'photo.png', { type: 'image/png' })],
      },
    });
    const form = screen.getByLabelText('Contanos tu historia').closest('form')!;
    fireEvent.submit(form);
    expect(submitPublicTestimonial).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Enviar testimonio' }),
    ).toBeDisabled();
    await act(async () => {
      readers[0].result = 'data:image/png;base64,c3ludGhldGlj';
      readers[0].readyState = 2;
      readers[0].onload?.();
    });
    fireEvent.submit(form);
    expect(submitPublicTestimonial).toHaveBeenCalledWith(
      'acme',
      expect.objectContaining({
        imageBase64: 'data:image/png;base64,c3ludGhldGlj',
      }),
    );
    await screen.findByRole('heading', { name: '¡Muchas gracias!' });
  });
});
