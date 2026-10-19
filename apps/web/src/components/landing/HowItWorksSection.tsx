import Link from 'next/link';
const steps = [
  {
    title: 'Recibí',
    description:
      'Configurá tu enlace de captura y abrí la recepción. Cada envío queda pendiente de revisión.',
    href: '/docs#captura',
    link: 'Preparar la captura',
  },
  {
    title: 'Revisá',
    description:
      'Leé el contenido, organizalo con categorías y etiquetas, y decidí si lo aprobás o rechazás.',
    href: '/docs#moderacion',
    link: 'Revisar testimonios',
  },
  {
    title: 'Publicá',
    description:
      'Publicá las historias aprobadas y compartí la galería de tu espacio. También podés consultarlas por API.',
    href: '/docs#publicacion',
    link: 'Compartir la galería',
  },
];
export function HowItWorksSection() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="process-title"
      className="scroll-mt-28 border-y bg-card py-14 sm:py-20"
    >
      <div className="container">
        <h2
          id="process-title"
          className="max-w-2xl text-balance font-caption text-3xl font-light italic leading-tight sm:text-5xl"
        >
          De la primera historia a tu galería.
        </h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="min-w-0 border-t pt-5">
              <span
                aria-hidden="true"
                className="font-caption text-3xl text-primary"
              >
                {index + 1}.
              </span>
              <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                {step.description}
              </p>
              <Link
                href={step.href}
                className="mt-4 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4"
              >
                {step.link}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
