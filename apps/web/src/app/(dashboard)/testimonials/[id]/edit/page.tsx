import { redirect, notFound } from 'next/navigation';
import { contextualTestimonialAlias } from '@/features/legacy-routes/testimonial-alias';
export default async function TestimonialAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const destination = contextualTestimonialAlias(id);
  if (!destination) notFound();
  redirect(destination);
}
