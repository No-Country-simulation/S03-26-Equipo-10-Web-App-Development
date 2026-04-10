import { FileText, CheckCircle, Rocket } from "lucide-react";

const steps = [
  {
    icon: FileText,
    number: "1",
    title: "Recopila",
    description: "Captura testimonios mediante formularios públicos o desde el panel de administración.",
  },
  {
    icon: CheckCircle,
    number: "2",
    title: "Modera",
    description: "Revisa, aprueba y organiza con categorías y etiquetas personalizadas.",
  },
  {
    icon: Rocket,
    number: "3",
    title: "Publica",
    description: "Inserta el widget en tu sitio o usa la API para mostrarlos dinámicamente.",
  },
];

export const HowItWorksSection = () => {
  return (
    <section className="py-20">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold text-foreground md:text-4xl">
            Cómo funciona
          </h2>
          <p className="mt-4 text-muted-foreground">
            Tres pasos para transformar las opiniones de tus clientes en tu ventaja competitiva.
          </p>
        </div>
        <div className="relative mt-14 grid gap-8 md:grid-cols-3">
          {/* Connector line (desktop) */}
          <div className="absolute left-[16.6%] right-[16.6%] top-[3.25rem] hidden h-0.5 bg-border md:block" aria-hidden="true" />

          {steps.map((step) => (
            <div key={step.number} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-background text-lg font-bold text-primary">
                {step.number}
              </div>
              <step.icon className="mt-4 h-6 w-6 text-primary/70" />
              <h3 className="mt-3 font-heading text-xl font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
