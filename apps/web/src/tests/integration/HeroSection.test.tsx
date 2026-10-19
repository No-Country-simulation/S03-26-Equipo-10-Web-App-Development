import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { HeroSection } from '@/components/landing/HeroSection';

describe('HeroSection', () => {
  it('explains receiving and deciding what to publish in its main heading', () => {
    render(<HeroSection />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Reuní buenas historias.Decidí cuáles publicar.',
    );
  });
  it('describes the actual reception, review and gallery workflow', () => {
    render(<HeroSection />);
    expect(
      screen.getByText(/Recibí testimonios, revisalos con tu equipo/),
    ).toBeInTheDocument();
  });
  it('provides registration and process destinations through links', () => {
    render(<HeroSection />);
    expect(
      screen.getByRole('link', { name: 'Crear tu espacio' }),
    ).toHaveAttribute('href', '/admin/register');
    expect(
      screen.getByRole('link', { name: 'Ver cómo funciona' }),
    ).toHaveAttribute('href', '/#como-funciona');
  });
  it('keeps reception and review available in the product explanation', () => {
    render(<HeroSection />);
    const context = within(
      screen.getByRole('complementary', { name: 'Qué podés gestionar' }),
    );
    expect(context.getByText('Un enlace para recibir')).toBeInTheDocument();
    expect(
      context.getByText('Una revisión antes de mostrar'),
    ).toBeInTheDocument();
  });
  it('states that the gallery only exposes published stories', () => {
    render(<HeroSection />);
    expect(
      screen.getByText('Sólo las historias publicadas se muestran al público.'),
    ).toBeInTheDocument();
  });
});
