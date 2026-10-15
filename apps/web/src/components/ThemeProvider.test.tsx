import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeProvider';
function Switch() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>{theme}</button>;
}
afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove('dark');
});
it('conserva tema y alternancia en memoria si el navegador bloquea storage', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  render(
    <ThemeProvider>
      <Switch />
    </ThemeProvider>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'dark' }));
  expect(screen.getByRole('button', { name: 'light' })).toBeInTheDocument();
  expect(document.documentElement).not.toHaveClass('dark');
  await user.click(screen.getByRole('button', { name: 'light' }));
  expect(document.documentElement).toHaveClass('dark');
  vi.unstubAllGlobals();
});
