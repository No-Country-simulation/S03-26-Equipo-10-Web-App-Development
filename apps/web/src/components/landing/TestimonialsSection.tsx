import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const testimonials = [
  {
    name: "María Gómez",
    role: "Directora de Marketing",
    company: "EdTech Academy",
    quote: "Testimonial CMS nos ha permitido centralizar todos los testimonios de nuestros cursos y mostrarlos en nuestra web con un widget en menos de 5 minutos. El CTR aumentó un 20%.",
    rating: 5,
    style: "bg-primary text-primary-foreground",
    layout: "md:col-span-2 md:row-span-2",
  },
  {
    name: "Carlos Rivera",
    role: "CTO",
    company: "SaaS Corp",
    quote: "La API es increíblemente fácil de usar. Integramos testimonios dinámicos en menos de 30 minutos. El scoring automático nos ahorra horas.",
    rating: 5,
    style: "bg-card text-card-foreground",
    layout: "md:col-span-1 md:row-span-1",
  },
  {
    name: "Ana Martínez",
    role: "Product Manager",
    company: "Agencia Digital MX",
    quote: "Con el multi-tenant manejamos los testimonios de 12 clientes desde un solo panel. Absolutamente brillante y con gran diseño.",
    rating: 4,
    style: "bg-foreground text-background",
    layout: "md:col-span-1 md:row-span-1",
  },
];

export const TestimonialsSection = () => {
  return (
    <section className="bg-section-alt py-32 px-6">
      <div className="container p-0">
        <div className="mb-20 flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between border-b border-foreground/10 pb-16">
          <div className="max-w-2xl">
            <h2 className="font-caption text-5xl font-light italic leading-tight text-foreground md:text-7xl">
              Autoridad en <br/>cada <strong className="font-body font-bold not-italic">palabra.</strong>
            </h2>
          </div>
          <p className="max-w-xs font-body text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Empresas globales construyendo confianza a escala.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2">
          {testimonials.map((t, index) => (
            <div 
              key={t.name} 
              className={cn(
                "group relative flex flex-col justify-between p-10 transition-transform duration-500 hover:-translate-y-2",
                t.style,
                t.layout
              )}
            >
              <div className="flex gap-1 mb-8 opacity-80">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn("h-5 w-5", i < t.rating ? "fill-current text-current" : "opacity-30")}
                  />
                ))}
              </div>
              
              <blockquote className="font-caption text-2xl italic leading-relaxed md:text-3xl lg:text-4xl">
                "{t.quote}"
              </blockquote>
              
              <div className="mt-12 flex items-center justify-between border-t border-current/20 pt-6">
                <div>
                  <p className="font-body text-lg font-bold uppercase tracking-wider">{t.name}</p>
                  <p className="font-body text-xs uppercase tracking-widest opacity-70">{t.role}, {t.company}</p>
                </div>
                <div className="text-6xl font-caption font-bold italic opacity-10">
                  {String(index + 1).padStart(2, '0')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
