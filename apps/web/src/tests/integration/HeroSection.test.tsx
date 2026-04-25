import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock Embla Carousel (it relies on DOM measurements unavailable in jsdom)
vi.mock('embla-carousel-react', () => ({
  __esModule: true,
  default: () => [vi.fn(), null],
}));

vi.mock('embla-carousel-autoplay', () => ({
  __esModule: true,
  default: () => ({}),
}));

// Mock lucide-react icons to simple span elements
vi.mock('lucide-react', () => ({
  ArrowRight: (props: any) => React.createElement('span', { 'data-testid': 'arrow-right' }),
  ArrowDown: (props: any) => React.createElement('span', { 'data-testid': 'arrow-down' }),
  Key: (props: any) => React.createElement('span', { 'data-testid': 'key-icon' }),
  Webhook: (props: any) => React.createElement('span', { 'data-testid': 'webhook-icon' }),
  TrendingUp: (props: any) => React.createElement('span', { 'data-testid': 'trending-icon' }),
  Shield: (props: any) => React.createElement('span', { 'data-testid': 'shield-icon' }),
}));

// The HeroSection module uses JSX at the top level (carouselSlides array).
// We must dynamically import AFTER mocks are set up so the module evaluates
// with the mocked lucide-react instead of the real one.
let HeroSection: React.ComponentType;

beforeAll(async () => {
  const mod = await import('@/components/landing/HeroSection');
  HeroSection = mod.HeroSection;
});

describe('HeroSection', () => {
  it('renders the main heading with editorial copy', () => {
    render(React.createElement(HeroSection));
    
    expect(screen.getByText('Voces que')).toBeInTheDocument();
    expect(screen.getByText('convierten.')).toBeInTheDocument();
  });

  it('renders the subheading paragraph', () => {
    render(React.createElement(HeroSection));
    
    expect(
      screen.getByText(/Gestiona, modera y despliega testimonios/i),
    ).toBeInTheDocument();
  });

  it('renders the CTA buttons', () => {
    render(React.createElement(HeroSection));
    
    expect(screen.getByText('Comenzar Ahora')).toBeInTheDocument();
    expect(screen.getByText('Ver Manifestos')).toBeInTheDocument();
  });

  it('renders the Testimonial CMS badge', () => {
    render(React.createElement(HeroSection));
    
    expect(screen.getByText('Testimonial CMS')).toBeInTheDocument();
  });

  it('renders the carousel slide titles', () => {
    render(React.createElement(HeroSection));
    
    expect(screen.getByText('API-First Design')).toBeInTheDocument();
    expect(screen.getByText('Webhooks en Tiempo Real')).toBeInTheDocument();
    expect(screen.getByText('Scoring Algorítmico')).toBeInTheDocument();
    expect(screen.getByText('Gestión Multi-Tenant')).toBeInTheDocument();
  });
});
