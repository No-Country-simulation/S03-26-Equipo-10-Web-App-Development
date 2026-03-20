import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'testimonial-cms',
  description: 'Flujo mínimo de autenticación y gestión de usuarios para Testimonial CMS.',
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
