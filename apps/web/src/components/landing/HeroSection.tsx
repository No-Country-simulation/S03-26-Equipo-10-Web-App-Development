import { ArrowRight, Play, Building2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export const HeroSection = () => {
  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Convierte las voces de tus clientes en tu mejor herramienta de marketing.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Gestiona, modera y muestra testimonios de forma sencilla. Aumenta la confianza y la conversión con nuestra plataforma todo en uno.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="gap-2 text-base">
              Empieza gratis <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" className="gap-2 text-base">
              <Play className="h-4 w-4" /> Ver demo
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4" /> Usado por +50 empresas
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-accent text-accent" /> 4.9 en Trustpilot
            </span>
          </div>
        </div>

        {/* Decorative mockup */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="overflow-hidden rounded-lg border bg-card shadow-soft-lg">
            <div className="flex items-center gap-1.5 border-b px-4 py-2.5">
              <span className="h-3 w-3 rounded-full bg-destructive/60" />
              <span className="h-3 w-3 rounded-full bg-accent/60" />
              <span className="h-3 w-3 rounded-full bg-primary/40" />
              <span className="ml-3 text-xs text-muted-foreground">tu-sitio-web.com/testimonios</span>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              {[
                { name: "María Gómez", role: "Marketing, EdTech", quote: "El CTR aumentó un 20% en solo dos semanas." },
                { name: "Carlos Rivera", role: "CTO, SaaS Corp", quote: "Integrar la API tomó menos de 30 minutos." },
              ].map((t) => (
                <div key={t.name} className="rounded-lg border bg-background p-4">
                  <p className="font-caption text-sm italic text-muted-foreground">"{t.quote}"</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {t.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
