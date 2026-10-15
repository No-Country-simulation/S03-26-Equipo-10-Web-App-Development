import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { useActionConfirmation } from './use-action-confirmation';
function Harness({ action }: { action: () => Promise<void> }) {
  const confirmation = useActionConfirmation();
  return (
    <>
      <button
        onClick={() =>
          confirmation.confirm({
            title: 'Eliminar destino',
            description: 'Destino sintético que dejará de recibir eventos.',
            confirmLabel: 'Eliminar destino',
            task: 'la eliminación',
            action,
          })
        }
      >
        Eliminar
      </button>
      {confirmation.dialog}
    </>
  );
}
it('cancelar no muta y conserva el foco de la acción original', async () => {
  const action = vi.fn();
  const user = userEvent.setup();
  render(<Harness action={action} />);
  const trigger = screen.getByRole('button', { name: 'Eliminar' });
  await user.click(trigger);
  expect(screen.getByRole('alertdialog')).toHaveTextContent(
    'Destino sintético',
  );
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
  );
  expect(action).not.toHaveBeenCalled();
  expect(trigger).toHaveFocus();
});
it('bloquea duplicados y Escape mientras espera y mantiene el error en contexto', async () => {
  let fail!: (e: Error) => void;
  const action = vi.fn(
    () =>
      new Promise<void>((_, reject) => {
        fail = reject;
      }),
  );
  const user = userEvent.setup();
  render(<Harness action={action} />);
  await user.click(screen.getByRole('button', { name: 'Eliminar' }));
  await user.dblClick(screen.getByRole('button', { name: 'Eliminar destino' }));
  await user.keyboard('{Escape}');
  expect(action).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  fail(new Error('unavailable'));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No pudimos confirmar',
  );
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
});
