import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardSidebar } from './DashboardSidebar';

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => '/admin') }));
vi.mock('next/navigation', () => ({ usePathname }));
vi.mock('next/link', () => ({ default: ({ href, children, onClick, ...props }: React.ComponentProps<'a'>) =>
  <a href={href} onClick={event => { event.preventDefault(); onClick?.(event); }} {...props}>{children}</a> }));
vi.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => <button type="button">Cambiar tema</button> }));

describe('DashboardSidebar mobile navigation', () => {
  beforeEach(() => { usePathname.mockReturnValue('/admin'); });

  it('opens with an accessible name, marks the current page and closes after navigation', async () => {
    const user = userEvent.setup();
    render(<DashboardSidebar userEmail="admin@example.test" userRoles={['admin']} isAdmin onLogout={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Abrir menú del panel' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Navegación del panel' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');

    await user.click(within(dialog).getByRole('link', { name: 'Testimonios' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes with Escape and restores focus to the menu trigger', async () => {
    const user = userEvent.setup();
    render(<DashboardSidebar isAdmin={false} onLogout={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Abrir menú del panel' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Navegación del panel' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
