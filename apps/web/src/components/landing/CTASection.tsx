import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function CTASection() {
  return (
    <section aria-labelledby="start-title" className="border-t py-14 sm:py-20">
      <div className="container grid items-center gap-7 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <h2
            id="start-title"
            className="max-w-2xl text-balance font-caption text-3xl font-light italic leading-tight sm:text-5xl"
          >
            Dale un lugar a la próxima historia.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            Creá tu espacio y prepará el enlace de captura. La ayuda te acompaña
            desde la recepción hasta la publicación.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 md:flex-col">
          <Button
            asChild
            size="lg"
            className="h-auto min-h-12 whitespace-normal rounded-none transition-none px-6 py-3 text-base"
          >
            <Link href="/admin/register">
              Crear un espacio
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Link
            href="/docs"
            className="inline-flex min-h-11 items-center justify-center text-sm text-primary underline underline-offset-4"
          >
            Leer la guía de inicio
          </Link>
        </div>
      </div>
    </section>
  );
}
