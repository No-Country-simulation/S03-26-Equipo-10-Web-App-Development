import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PublicTestimonialsPage from './public-testimonials-screen';
const { list, track, info, params } = vi.hoisted(() => ({
  list: vi.fn(),
  track: vi.fn(),
  info: vi.fn(),
  params: { slug: 'synthetic-storage-check' },
}));
vi.mock('next/navigation', () => ({ useParams: () => params }));
vi.mock('../api', () => ({
  listPublicTestimonials: list,
  trackPublicEvent: track,
}));
vi.mock('@/features/public-capture/api', () => ({ getFormInfo: info }));
vi.mock('@/components/ui/NoiseOverlay', () => ({ NoiseOverlay: () => null }));
const record = (n = 1) => ({
  id: `synthetic-${n}`,
  authorName: `Autor sintético ${n}`,
  content: 'Texto sintético de una experiencia para compartir',
  rating: 4,
  score: 0,
});
beforeEach(() => {
  vi.clearAllMocks();
  params.slug = 'synthetic-storage-check';
  info.mockResolvedValue({
    name: 'Marca sintética',
    logoUrl: null,
    isPublicFormEnabled: false,
  });
  list.mockResolvedValue({
    items: [record()],
    meta: { total: 1, page: 1, limit: 20 },
  });
  track.mockResolvedValue({ tracked: true });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('reads, rates and expands independently of denied storage and failed tracking', async () => {
  for (const method of ['getItem', 'setItem', 'removeItem'] as const)
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
  track.mockRejectedValueOnce(new Error('offline'));
  render(<PublicTestimonialsPage />);
  const user = userEvent.setup();
  expect(
    await screen.findByRole('img', { name: '4 de 5 estrellas' }),
  ).toHaveTextContent('4 de 5');
  const button = screen.getByRole('button', { name: /Ver detalle/ });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  await user.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(
    document.getElementById(button.getAttribute('aria-controls')!),
  ).toHaveTextContent('Texto sintético');
  await waitFor(() => expect(track).toHaveBeenCalledTimes(1));
  await user.click(screen.getByRole('button', { name: /Ocultar detalle/ }));
  await user.click(screen.getByRole('button', { name: /Ver detalle/ }));
  await waitFor(() => expect(track).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('View')).not.toBeInTheDocument();
});
it('reaches publication 21 and retains prior content when a next page fails', async () => {
  list
    .mockResolvedValueOnce({
      items: Array.from({ length: 20 }, (_, i) => record(i + 1)),
      meta: { total: 21, page: 1, limit: 20 },
    })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({
      items: [record(21)],
      meta: { total: 21, page: 2, limit: 20 },
    });
  const user = userEvent.setup();
  render(<PublicTestimonialsPage />);
  expect(
    await screen.findByText('Mostrando 20 de 21 testimonios publicados.'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Marca sintética' }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Cargar más' }));
  expect(
    await screen.findByRole('button', { name: 'Reintentar' }),
  ).toBeEnabled();
  expect(screen.getAllByRole('article')).toHaveLength(20);
  await user.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(
    await screen.findByRole('heading', { name: 'Autor sintético 21' }),
  ).toHaveFocus();
  expect(screen.getAllByRole('article')).toHaveLength(21);
  expect(
    screen.queryByRole('button', { name: 'Cargar más' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText('Llegaste al final de los testimonios disponibles.'),
  ).toBeInTheDocument();
});
it('keeps published content available when brand metadata fails', async () => {
  info.mockRejectedValue(new Error('offline'));
  render(<PublicTestimonialsPage />);
  expect(
    await screen.findByRole('heading', { name: 'Autor sintético 1' }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('button', { name: 'Reintentar marca' }),
  ).toBeEnabled();
});
it('does not leak a late page into another slug', async () => {
  let finish!: (value: unknown) => void;
  list.mockImplementation((_slug: string, page: number) =>
    page === 2
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : Promise.resolve({
          items: [record()],
          meta: { total: 21, page: 1, limit: 20 },
        }),
  );
  const user = userEvent.setup();
  const view = render(<PublicTestimonialsPage />);
  await user.click(await screen.findByRole('button', { name: 'Cargar más' }));
  params.slug = 'other-slug';
  view.rerender(<PublicTestimonialsPage />);
  await act(async () => {
    finish({ items: [record(21)], meta: { total: 21, page: 2, limit: 20 } });
  });
  expect(screen.queryByText('Autor sintético 21')).not.toBeInTheDocument();
});
it('loads YouTube only on demand and falls back externally after player failure', async () => {
  list.mockResolvedValue({
    items: [
      {
        ...record(70),
        videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
      },
    ],
    meta: { page: 1, limit: 20, total: 1 },
  });
  const user = userEvent.setup();
  render(<PublicTestimonialsPage />);
  const play = await screen.findByRole('button', {
    name: 'Reproducir video de Autor sintético 70',
  });
  expect(
    document.querySelector('script[src="https://www.youtube.com/iframe_api"]'),
  ).toBeNull();
  await user.click(play);
  const script = document.querySelector(
    'script[src="https://www.youtube.com/iframe_api"]',
  );
  expect(script).not.toBeNull();
  await act(async () => {
    script!.dispatchEvent(new Event('error'));
  });
  expect(
    await screen.findByRole('link', { name: 'Abrir video en YouTube' }),
  ).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abcdefghijk');
});
it('keeps a safe external video fallback for unsupported legacy URLs', async () => {
  list.mockResolvedValue({
    items: [
      { ...record(80), videoUrl: 'https://media.example.invalid/legacy' },
    ],
    meta: { page: 1, limit: 20, total: 1 },
  });
  render(<PublicTestimonialsPage />);
  expect(
    await screen.findByRole('link', { name: 'Abrir video original' }),
  ).toHaveAttribute('href', 'https://media.example.invalid/legacy');
});
