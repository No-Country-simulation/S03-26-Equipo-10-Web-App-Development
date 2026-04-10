import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const CTASection = () => {
  return (
    <section className="py-20">
      <div className="container">
        <div className="mx-auto max-w-2xl rounded-lg border bg-card p-10 text-center shadow-soft-lg md:p-16">
          <h2 className="font-heading text-3xl font-semibold text-foreground md:text-4xl">
            Comienza a mostrar el verdadero valor de tus clientes.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Prueba gratuita de 14 días, sin compromiso.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="gap-2 text-base">
              Empieza ahora <ArrowRight className="h-4 w-4" />
            </Button>
            <a href="#" className="text-sm font-medium text-primary transition-colors hover:text-primary/80">
              Hablar con ventas →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
