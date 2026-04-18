import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { NoiseOverlay } from '@/components/ui/NoiseOverlay';
import { Funnel_Sans, Geist, Newsreader } from 'next/font/google';

const funnelSans = Funnel_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-caption',
  display: 'swap',
});

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
      <body className={`min-h-screen bg-background antialiased text-foreground overflow-x-hidden selection:bg-primary selection:text-primary-foreground ${funnelSans.variable} ${geist.variable} ${newsreader.variable} font-body`}>
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
