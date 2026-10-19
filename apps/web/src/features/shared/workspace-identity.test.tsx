import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import {
  WorkspaceIdentityProvider,
  useWorkspaceIdentity,
} from './workspace-identity';
function Consumer() {
  const identity = useWorkspaceIdentity();
  return (
    <>
      <p>{identity?.name}</p>
      <button onClick={() => identity?.rename('Nombre confirmado')}>
        Confirmar nombre
      </button>
    </>
  );
}
it('shares a confirmed name in memory and resets identity for another workspace', async () => {
  const view = render(
    <WorkspaceIdentityProvider key="tenant-a" name="Espacio A">
      <Consumer />
    </WorkspaceIdentityProvider>,
  );
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Confirmar nombre' }));
  expect(screen.getByText('Nombre confirmado')).toBeInTheDocument();
  view.rerender(
    <WorkspaceIdentityProvider key="tenant-b" name="Espacio B">
      <Consumer />
    </WorkspaceIdentityProvider>,
  );
  expect(screen.getByText('Espacio B')).toBeInTheDocument();
  expect(screen.queryByText('Nombre confirmado')).not.toBeInTheDocument();
});
