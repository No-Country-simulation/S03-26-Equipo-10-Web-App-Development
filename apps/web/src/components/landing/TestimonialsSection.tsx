import { Star } from "lucide-react";

const testimonials = [
  {
    name: "María Gómez",
    role: "Directora de Marketing",
    company: "EdTech Academy",
    quote: "Testimonial CMS nos ha permitido centralizar todos los testimonios de nuestros cursos y mostrarlos en nuestra web con un widget en menos de 5 minutos. El CTR aumentó un 20%.",
    rating: 5,
  },
  {
    name: "Carlos Rivera",
    role: "CTO",
    company: "SaaS Corp",
    quote: "La API es increíblemente fácil de usar. Integramos testimonios dinámicos en nuestra app en menos de 30 minutos. El scoring automático nos ahorra horas de curación manual.",
    rating: 5,
  },
  {
    name: "Ana Martínez",
    role: "Product Manager",
    company: "Agencia Digital MX",
    quote: "Con el multi‑tenant manejamos los testimonios de 12 clientes desde un solo panel. Los webhooks a Slack nos mantienen al día sin esfuerzo.",
    rating: 4,
  },
];

export const TestimonialsSection = () => {
  return (
    <section className="py-20">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold text-foreground md:text-4xl">
            Lo que dicen nuestros clientes
          </h2>
          <p className="mt-4 text-muted-foreground">
            Empresas de todos los tamaños confían en Testimonial CMS para potenciar su prueba social.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.name} className="flex flex-col rounded-lg border bg-card p-6 shadow-soft">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < t.rating ? "fill-accent text-accent" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 font-caption text-sm italic leading-relaxed text-muted-foreground">
                "{t.quote}"
              </blockquote>
              <div className="mt-6 flex items-center gap-3 border-t pt-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-bold text-primary">
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}, {t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
