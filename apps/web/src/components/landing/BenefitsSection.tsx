import { Database, ShieldCheck, Globe, ArrowRight } from "lucide-react";

const benefits = [
  {
    icon: Database,
    title: "Centraliza tus testimonios",
    description: "Olvídate de correos y archivos sueltos. Todo en un solo panel organizado y accesible.",
  },
  {
    icon: ShieldCheck,
    title: "Moderación inteligente",
    description: "Aprueba o rechaza testimonios antes de publicarlos. Mantén el control total.",
  },
  {
    icon: Globe,
    title: "Distribuye en cualquier lugar",
    description: "API, widget embebible y webhooks para integrar con tu web en minutos.",
  },
];

export const BenefitsSection = () => {
  return (
    <section id="producto" className="bg-section-alt py-20">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold text-foreground md:text-4xl">
            Todo lo que necesitas para gestionar testimonios
          </h2>
          <p className="mt-4 text-muted-foreground">
            Una plataforma diseñada para equipos de marketing y producto que buscan maximizar la prueba social.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.title} className="group rounded-lg border bg-card p-6 shadow-soft transition-shadow hover:shadow-soft-lg">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <b.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.description}</p>
              <a href="#" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80">
                Saber más <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
