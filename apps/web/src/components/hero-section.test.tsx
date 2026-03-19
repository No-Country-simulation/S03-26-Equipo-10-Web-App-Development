import { render, screen } from '@testing-library/react';
import { HeroSection } from './hero-section';

describe('HeroSection', () => {
  it('renders the main value proposition', () => {
    render(<HeroSection />);

    expect(
      screen.getByRole('heading', {
        name: /centraliza testimonios sin arrancar desde cero/i,
      }),
    ).toBeInTheDocument();
  });
});
