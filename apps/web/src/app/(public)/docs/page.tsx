import type { Metadata } from 'next';
import HelpScreen from '@/features/help/screens/help-screen';
export const metadata: Metadata = {
  title: 'Ayuda para recibir y publicar testimonios',
  description:
    'Guía de captura, moderación, publicación, API keys y webhooks de Testimonial CMS.',
};
export default function DocsPage() {
  return <HelpScreen />;
}
