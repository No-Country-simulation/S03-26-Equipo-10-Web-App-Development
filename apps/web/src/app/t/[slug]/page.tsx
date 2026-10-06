import type { Metadata } from 'next';
import PublicTestimonialsScreen from '@/features/public-testimonials/screens/public-testimonials-screen';

export const metadata: Metadata = {
  title: 'Testimonios publicados',
  description: 'Experiencias publicadas por una marca que usa Testimonial CMS.',
  openGraph: {
    type: 'website',
    title: 'Testimonios publicados | Testimonial CMS',
    description: 'Experiencias publicadas por una marca que usa Testimonial CMS.',
  },
};

export default function Page() {
  return <PublicTestimonialsScreen />;
}
