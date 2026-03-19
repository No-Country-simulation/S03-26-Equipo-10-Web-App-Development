import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'testimonial-cms',
  description: 'Scaffolding inicial para gestionar testimonios.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
