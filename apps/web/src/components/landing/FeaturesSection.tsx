import { TrendingUp, BarChart3, Palette, Webhook, Users, Code2 } from "lucide-react";

const features = [
  {
    icon: TrendingUp,
    title: "Scoring automático",
    description: "Nuestro algoritmo destaca los testimonios más relevantes en función del engagement.",
  },
  {
    icon: BarChart3,
    title: "Analítica en tiempo real",
    description: "Mide vistas, clics y CTR para optimizar tu contenido de prueba social.",
  },
  {
    icon: Palette,
    title: "Widget personalizable",
    description: "Ajusta colores, tipografía y diseño sin tocar una línea de código.",
  },
  {
    icon: Webhook,
    title: "Webhooks en tiempo real",
    description: "Conecta con Slack, CRM o cualquier sistema externo cuando se publique un testimonio.",
  },
  {
    icon: Users,
    title: "Multi-tenant",
    description: "Ideal para agencias o empresas con múltiples marcas, todo aislado y seguro.",
  },
  {
    icon: Code2,
    title: "API pública",
    description: "Accede a tus testimonios desde cualquier aplicación con nuestra REST API.",
  },
];

export const FeaturesSection = () => {
  return (
    <section className="py-32">
      <div className="container">
        <div className="mb-20 flex flex-col gap-6 md:flex-row md:items-end md:justify-between border-b border-foreground/10 pb-16">
          <div className="max-w-2xl">
            <span className="font-body text-xs font-bold uppercase tracking-widest text-primary">Características</span>
            <h2 className="mt-4 font-caption text-4xl font-light italic leading-tight text-foreground md:text-6xl">
              Herramientas que <br />
              <strong className="font-body font-bold not-italic">marcan diferencia.</strong>
            </h2>
          </div>
          <p className="max-w-xs font-body text-sm text-muted-foreground uppercase tracking-widest font-medium">
            Potencia cada aspecto de tu prueba social.
          </p>
        </div>
        
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group bg-background p-10 transition-colors hover:bg-card">
              <f.icon className="mb-6 h-6 w-6 text-primary transition-transform duration-300 group-hover:scale-110" />
              <h3 className="font-body text-base font-bold uppercase tracking-wider text-foreground">{f.title}</h3>
              <p className="mt-3 font-body text-sm leading-relaxed text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
