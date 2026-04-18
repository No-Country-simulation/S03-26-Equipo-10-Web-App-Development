import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const testimonials = [
  {
    name: "Santiago Valdés",
    role: "CTO",
    company: "Fintech Horizon",
    avatar: "https://i.pravatar.cc/800?img=13",
    quote: "La integración vía API nos tomó exactamente 18 minutos. El scoring algorítmico automáticamente colocó las reseñas más detalladas al frente. Redujimos el abandono del onboarding en un 22%.",
    rating: 5,
    category: "Ingeniería",
    tags: ["API REST", "Scoring"],
    style: "bg-primary text-primary-foreground",
    layout: "md:col-span-2 md:row-span-2",
  },
  {
    name: "Elena Rostova",
    role: "Directora de Growth",
    company: "SaaS Analytics",
    avatar: "https://i.pravatar.cc/800?img=5",
    quote: "Los Webhooks en tiempo real transformaron nuestro flujo. Aprobamos un testimonio y automáticamente aparece en nuestro sitio web y se notifica al equipo de ventas en Slack. Impecable.",
    rating: 5,
    category: "Marketing",
    tags: ["Webhooks", "Automatización"],
    style: "bg-card text-card-foreground",
    layout: "md:col-span-1 md:row-span-1",
  },
  {
    name: "Marcos Villanueva",
    role: "Product Manager",
    company: "Agencia Neo",
    avatar: "https://i.pravatar.cc/800?img=12",
    quote: "Manejar a 15 clientes B2B desde un solo panel multi-tenant parecía imposible hasta que descubrimos Testimonial CMS. La segmentación por categorías es exactamente lo que necesitábamos.",
    rating: 4,
    category: "Agencias",
    tags: ["Multi-Tenant", "B2B"],
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
              Autoridad en <br />cada <strong className="font-body font-bold not-italic">palabra.</strong>
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
              <div className="flex items-center justify-between mb-8">
                <div className="flex gap-1 opacity-80">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn("h-5 w-5", i < t.rating ? "fill-current text-current" : "opacity-30")}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <span className={cn(
                    "font-body text-[10px] uppercase font-bold px-2 py-1",
                    t.style.includes("bg-primary") ? "bg-background/20 text-primary-foreground" :
                      t.style.includes("bg-foreground") ? "bg-background/20 text-background" :
                        "bg-primary/10 text-primary"
                  )}>
                    {t.category}
                  </span>
                  {t.tags.map(tag => (
                    <span key={tag} className="font-body text-[10px] uppercase border px-2 py-1 opacity-70">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <blockquote className="font-caption text-2xl italic leading-relaxed md:text-3xl lg:text-4xl">
                &quot;{t.quote}&quot;
              </blockquote>

              <div className="mt-12 flex items-center justify-between border-t border-current/20 pt-6">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <img src={t.avatar} alt={t.name} className="h-12 w-12 object-cover border border-current" />
                  <div>
                    <p className="font-body text-lg font-bold uppercase tracking-wider">{t.name}</p>
                    <p className="font-body text-xs uppercase tracking-widest opacity-70">{t.role}, {t.company}</p>
                  </div>
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
