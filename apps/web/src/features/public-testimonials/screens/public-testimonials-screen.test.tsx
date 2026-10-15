import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PublicTestimonialsPage from './public-testimonials-screen';
const { list, track } = vi.hoisted(() => ({ list: vi.fn(), track: vi.fn() }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'synthetic-storage-check' }),
}));
vi.mock('../api', () => ({
  listPublicTestimonials: list,
  trackPublicEvent: track,
}));
vi.mock('@/components/ui/NoiseOverlay', () => ({ NoiseOverlay: () => null }));
beforeEach(() => {
  list.mockResolvedValue([
    {
      id: 'synthetic-public',
      authorName: 'Autor sintético',
      content: 'Texto sintético de una experiencia para compartir',
      rating: 4,
      score: 0,
    },
  ]);
  track.mockReset().mockResolvedValue({ tracked: true });
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
it('lectura, valoración y expansión funcionan con storage denegado y tracking fallido', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  track.mockRejectedValueOnce(new Error('offline'));
  render(<PublicTestimonialsPage />);
  const user = userEvent.setup();
  expect(
    await screen.findByRole('img', { name: '4 de 5 estrellas' }),
  ).toHaveTextContent('4 de 5');
  const button = screen.getByRole('button', { name: 'Ver detalle' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  await user.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  const id = button.getAttribute('aria-controls')!;
  expect(document.getElementById(id)).toHaveTextContent('Texto sintético');
  await waitFor(() => expect(track).toHaveBeenCalledTimes(1));
  await user.click(screen.getByRole('button', { name: 'Ocultar detalle' }));
  await user.click(screen.getByRole('button', { name: 'Ver detalle' }));
  await waitFor(() => expect(track).toHaveBeenCalledTimes(2));
  expect(screen.getByText('Autor sintético')).toBeInTheDocument();
});
