import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import HelpScreen from './help-screen';
vi.mock('@/hooks/use-session', () => ({
  useSession: () => ({ session: null, logout: vi.fn() }),
}));
it('offers five actionable help topics with valid in-page destinations', () => {
  render(<HelpScreen />);
  const topics = screen.getByRole('navigation', { name: 'Temas de ayuda' });
  for (const anchor of topics.querySelectorAll('a[href^="#"]')) {
    const target = document.querySelector(anchor.getAttribute('href')!);
    expect(target).not.toBeNull();
    expect(target?.querySelector('h2,h3')).not.toBeNull();
  }
  expect(topics.querySelectorAll('a[href^="#"]')).toHaveLength(5);
  expect(screen.getByText('Aprobar no publica.')).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'API keys: acceso desde tu servidor' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Webhooks: del evento a tu receptor' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
});
