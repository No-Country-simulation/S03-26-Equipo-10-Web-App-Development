import type { Metadata } from 'next';
import CaptureScreen from '@/features/public-capture/screens/capture-screen';

export const metadata: Metadata = {
  title: 'Compartí tu experiencia',
  description: 'Formulario para enviar una experiencia a una marca que usa Testimonial CMS.',
  openGraph: {
    type: 'website',
    title: 'Compartí tu experiencia | Testimonial CMS',
    description: 'Formulario para enviar una experiencia a una marca que usa Testimonial CMS.',
  },
};

export default function Page() {
  return <CaptureScreen />;
}
