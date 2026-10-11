import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('composición de estilos con Tailwind 4', () => {
  it('permite que la pantalla sobrescriba el tamaño, sombra y color de la primitiva', () => {
    expect(cn('h-10 shadow-xs bg-primary', 'h-12 shadow-soft bg-muted')).toBe('h-12 shadow-soft bg-muted');
  });

  it('conserva el foco accesible y las variantes de tema y breakpoint', () => {
    expect(cn('focus-visible:outline-hidden focus-visible:ring-2 text-sm md:text-lg dark:bg-card', 'text-xs'))
      .toBe('focus-visible:outline-hidden focus-visible:ring-2 md:text-lg dark:bg-card text-xs');
  });

  it('combina familias semánticas sin perder el peso tipográfico', () => {
    expect(cn('font-body font-bold', 'font-caption')).toBe('font-bold font-caption');
  });

  it('resuelve anchos de variables sin confundir colores y bordes semánticos', () => {
    expect(cn('w-(--sidebar-width) border border-border bg-card', 'w-(--sidebar-width-icon)'))
      .toBe('border border-border bg-card w-(--sidebar-width-icon)');
  });
});
