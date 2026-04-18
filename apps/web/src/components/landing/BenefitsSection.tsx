import { Database, ShieldCheck, Globe } from "lucide-react";

const benefits = [
  {
    icon: Database,
    title: "Centraliza",
    description: "Olvídate de correos y archivos sueltos. Todo en un solo panel organizado y accesible.",
  },
  {
    icon: ShieldCheck,
    title: "Modera",
    description: "Aprueba o rechaza testimonios antes de publicarlos. Mantén el control total sobre tu marca.",
  },
  {
    icon: Globe,
    title: "Distribuye",
    description: "API, widget embebible y webhooks para integrar con tu web en minutos, sin código.",
  },
];

export const BenefitsSection = () => {
  return (
    <section id="producto" className="py-32">
      <div className="container">
        <header className="mb-20 max-w-3xl animate-fade-in-up">
          <span className="font-body text-xs font-bold uppercase tracking-widest text-primary">Producto</span>
          <h2 className="mt-4 font-caption text-4xl font-light italic leading-tight text-foreground md:text-6xl text-balance">
            Todo lo que necesitas,<br />
            <strong className="font-body font-bold not-italic">nada que no.</strong>
          </h2>
        </header>
        
        <div className="grid gap-0 border-t md:grid-cols-3">
          {benefits.map((b, index) => (
            <article 
              key={b.title} 
              className={`group flex flex-col justify-between border-b p-10 transition-colors hover:bg-card md:border-b-0 md:border-r last:md:border-r-0 animate-fade-in-up stagger-${index + 1}`}
            >
              <div>
                <header className="mb-8 flex items-center gap-4">
                  <span className="font-caption text-5xl font-bold italic text-primary/20">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <b.icon className="h-6 w-6 text-primary" />
                </header>
                <h3 className="font-body text-xl font-bold uppercase tracking-wider text-foreground">{b.title}</h3>
                <p className="mt-4 font-body text-sm leading-relaxed text-muted-foreground">{b.description}</p>
              </div>
              <footer className="mt-8 h-px w-12 bg-primary transition-all duration-500 group-hover:w-full" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
