import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect } from 'vitest';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './dialog';
it('ofrece cierre en español y devuelve el foco al disparador', async () => {
  render(
    <Dialog>
      <DialogTrigger>Abrir detalle</DialogTrigger>
      <DialogContent>
        <DialogTitle>Detalle</DialogTitle>
        <DialogDescription>Contenido de prueba</DialogDescription>
      </DialogContent>
    </Dialog>,
  );
  const user = userEvent.setup();
  const trigger = screen.getByRole('button', { name: 'Abrir detalle' });
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'Cerrar diálogo' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(trigger).toHaveFocus();
});
