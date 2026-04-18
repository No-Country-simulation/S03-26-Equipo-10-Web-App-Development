import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { NoiseOverlay } from '@/components/ui/NoiseOverlay';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f0ede6' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export const metadata: Metadata = {
  title: {
    default: 'Testimonial CMS | Gestión de Confianza',
    template: '%s | Testimonial CMS',
  },
  description: 'Plataforma neo-editorial para recopilar, gestionar y publicar testimonios de clientes con analítica integrada y algoritmos de relevancia.',
  keywords: ['testimonios', 'cms', 'reputación', 'reseñas', 'saas', 'gestión de clientes'],
  authors: [{ name: 'Testimonial CMS Team' }],
  creator: 'Testimonial CMS',
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: 'https://testimonial-cms.com',
    title: 'Testimonial CMS | Gestión de Confianza',
    description: 'Plataforma neo-editorial para recopilar, gestionar y publicar testimonios de clientes.',
    siteName: 'Testimonial CMS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Testimonial CMS',
    description: 'Recopila y publica testimonios con elegancia.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Funnel+Sans:ital,wght@0,300..800;1,300..800&family=Geist:wght@100..900&family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background font-body antialiased text-foreground overflow-x-hidden selection:bg-primary selection:text-primary-foreground">
        <NoiseOverlay />
        <ThemeProvider>
          <TooltipProvider>
            {children}
            <Toaster />
            <Sonner />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
