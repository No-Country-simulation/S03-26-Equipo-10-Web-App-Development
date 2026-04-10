import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const CTASection = () => {
  return (
    <section className="py-32">
      <div className="container">
        <div className="relative bg-foreground text-background p-16 md:p-24 overflow-hidden">
          {/* Decorative large italic text */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 font-caption text-[12rem] font-bold italic leading-none text-background/5 select-none pointer-events-none hidden lg:block">
            CMS
          </div>
          
          <div className="relative z-10 max-w-2xl">
            <h2 className="font-caption text-4xl font-light italic leading-tight md:text-6xl">
              Comienza a mostrar el <strong className="font-body font-bold not-italic text-primary">verdadero valor</strong> de tus clientes.
            </h2>
            <p className="mt-6 font-body text-sm leading-relaxed opacity-60">
              Prueba gratuita de 14 días, sin compromiso. Sin tarjeta de crédito.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button size="lg" className="h-14 bg-primary px-8 font-body text-sm uppercase tracking-wider text-primary-foreground hover:bg-primary/90">
                Empieza Ahora <ArrowRight className="ml-3 h-4 w-4" />
              </Button>
              <a href="#" className="font-body text-sm font-medium uppercase tracking-widest text-background/60 transition-colors hover:text-background">
                Hablar con ventas →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
