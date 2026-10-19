import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function HeroSection() {
  return (
    <section
      aria-labelledby="landing-title"
      className="border-b py-14 sm:py-20 lg:py-28"
    >
      <div className="container grid items-end gap-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,1fr)] lg:gap-16">
        <div className="min-w-0">
          <h1
            id="landing-title"
            className="max-w-4xl text-balance font-caption text-[clamp(2.5rem,7vw,6rem)] font-light leading-[1.05] tracking-tight"
          >
            Reuní buenas historias.
            <br />
            <em className="text-primary">Decidí cuáles publicar.</em>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Recibí testimonios, revisalos con tu equipo y compartí una galería
            con la identidad de tu espacio.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="h-auto min-h-12 whitespace-normal rounded-none transition-none px-6 py-3 text-base"
            >
              <Link href="/admin/register">
                Crear tu espacio
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-auto min-h-12 whitespace-normal rounded-none transition-none px-6 py-3 text-base"
            >
              <Link href="/#como-funciona">Ver cómo funciona</Link>
            </Button>
          </div>
        </div>
        <aside
          aria-label="Qué podés gestionar"
          className="min-w-0 border-t pt-6 lg:border-t-0 lg:pb-1 lg:pt-0"
        >
          <h2 className="font-caption text-2xl italic">
            Del envío a la publicación
          </h2>
          <dl className="mt-5 divide-y border-y text-sm">
            <div className="py-4">
              <dt className="font-semibold">Un enlace para recibir</dt>
              <dd className="mt-2 leading-relaxed text-muted-foreground">
                Texto, valoración y medios opcionales, con tu nombre y logo.
              </dd>
            </div>
            <div className="py-4">
              <dt className="font-semibold">Una revisión antes de mostrar</dt>
              <dd className="mt-2 leading-relaxed text-muted-foreground">
                Aprobá, organizá y publicá desde el panel.
              </dd>
            </div>
            <div className="py-4">
              <dt className="font-semibold">Una galería para compartir</dt>
              <dd className="mt-2 leading-relaxed text-muted-foreground">
                Sólo las historias publicadas se muestran al público.
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
