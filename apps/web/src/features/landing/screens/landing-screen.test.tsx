import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import Home from '@/app/page';
vi.mock('@/hooks/use-session', () => ({
  useSession: () => ({ session: null, loading: false, logout: vi.fn() }),
}));
it('makes the primary action an actual registration link', () => {
  render(<Home />);
  expect(
    screen.getByRole('link', { name: /^Crear tu espacio$/ }),
  ).toHaveAttribute('href', '/admin/register');
});
it('keeps unapproved commercial content and claims out of the public page', () => {
  render(<Home />);
  expect(screen.queryByText('$29')).not.toBeInTheDocument();
  expect(
    screen.queryByText(/Prueba gratuita de 14 días/),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Santiago Valdés')).not.toBeInTheDocument();
  expect(screen.queryByText('Widget personalizable')).not.toBeInTheDocument();
  for (const link of screen.getAllByRole('link'))
    expect(link).not.toHaveAttribute('href', '#');
});
