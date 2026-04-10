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
    title: "Multi‑tenant",
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
    <section className="bg-section-alt py-20">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold text-foreground md:text-4xl">
            Características destacadas
          </h2>
          <p className="mt-4 text-muted-foreground">
            Herramientas potentes para gestionar y maximizar el valor de tus testimonios.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-6 shadow-soft transition-shadow hover:shadow-soft-lg">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-heading text-base font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
