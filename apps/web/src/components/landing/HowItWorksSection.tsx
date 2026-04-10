export const HowItWorksSection = () => {
  const steps = [
    {
      number: "01",
      title: "Recopila",
      description: "Captura testimonios mediante formularios públicos o desde el panel de administración. Sin fricción.",
    },
    {
      number: "02",
      title: "Modera",
      description: "Revisa, aprueba y organiza con categorías y etiquetas personalizadas. Control absoluto.",
    },
    {
      number: "03",
      title: "Publica",
      description: "Inserta el widget en tu sitio o usa la API para mostrarlos dinámicamente. En minutos.",
    },
  ];

  return (
    <section className="bg-foreground text-background py-32">
      <div className="container">
        <div className="mb-20 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <span className="font-body text-xs font-bold uppercase tracking-widest text-primary">Proceso</span>
            <h2 className="mt-4 font-caption text-4xl font-light italic leading-tight md:text-6xl">
              Tres pasos.<br />
              <strong className="font-body font-bold not-italic text-primary">Cero complicaciones.</strong>
            </h2>
          </div>
        </div>

        <div className="grid gap-0 border-t border-background/20 md:grid-cols-3">
          {steps.map((step) => (
            <div 
              key={step.number} 
              className="group flex flex-col gap-6 border-b border-background/20 p-10 transition-colors hover:bg-background/5 md:border-b-0 md:border-r md:last:border-r-0"
            >
              <span className="font-caption text-7xl font-bold italic text-primary/30 transition-colors group-hover:text-primary">
                {step.number}
              </span>
              <div>
                <h3 className="font-body text-2xl font-bold uppercase tracking-wider">{step.title}</h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-background/60">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
