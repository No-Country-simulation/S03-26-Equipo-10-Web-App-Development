import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TenantLogo } from './tenant-logo';

describe('TenantLogo', () => {
  it('reserves the same size for missing and broken images, and resets when the company changes', () => {
    const { rerender } = render(<TenantLogo name="Acme Norte" logoUrl={null} />);
    expect(screen.getByRole('img', { name: 'Iniciales de Acme Norte' })).toHaveTextContent('AN');
    rerender(<TenantLogo name="Acme Norte" logoUrl="https://res.cloudinary.com/demo/image/upload/acme.png" />);
    const first = screen.getByRole('img', { name: 'Logo de Acme Norte' });
    expect(first).toHaveAttribute('width', '80');
    expect(first).toHaveAttribute('height', '80');
    fireEvent.error(first);
    expect(screen.getByRole('img', { name: 'Iniciales de Acme Norte' })).toBeInTheDocument();
    rerender(<TenantLogo name="Otra empresa" logoUrl="https://res.cloudinary.com/demo/image/upload/other.png" />);
    expect(screen.getByRole('img', { name: 'Logo de Otra empresa' })).toBeInTheDocument();
  });
});
