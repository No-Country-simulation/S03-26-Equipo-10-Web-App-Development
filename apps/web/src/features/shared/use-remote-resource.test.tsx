import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRemoteResource } from './use-remote-resource';

function View({ load }: { load: () => Promise<string> }) {
  const { state } = useRemoteResource(load, true);
  return <p>{state.status === 'success' ? state.data : state.status}</p>;
}

describe('useRemoteResource', () => {
  it('does not render data returned by a previous route after the loader changes', async () => {
    let completeOld: (value: string) => void = () => {};
    const oldLoad = () => new Promise<string>(resolve => { completeOld = resolve; });
    const newLoad = () => Promise.resolve('Nuevo tenant');
    const view = render(<View load={oldLoad} />);

    view.rerender(<View load={newLoad} />);
    expect(await screen.findByText('Nuevo tenant')).toBeInTheDocument();
    await act(async () => { completeOld('Tenant anterior'); });
    expect(screen.getByText('Nuevo tenant')).toBeInTheDocument();
    expect(screen.queryByText('Tenant anterior')).not.toBeInTheDocument();
  });
});
