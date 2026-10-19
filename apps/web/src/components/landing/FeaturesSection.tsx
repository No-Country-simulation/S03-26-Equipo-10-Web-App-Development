import Link from 'next/link';
const features = [
  {
    title: 'Marca y clasificación',
    description:
      'Configurá nombre y logo. Organizá tus testimonios con categorías y etiquetas.',
    href: '/docs#captura',
    link: 'Configurar la recepción',
  },
  {
    title: 'Analítica de interacción',
    description:
      'Consultá las vistas, los clics y las reproducciones registradas. Los eventos enlazan a su testimonio.',
    href: '/docs#publicacion',
    link: 'Entender la publicación y sus métricas',
  },
  {
    title: 'Orden por relevancia',
    description:
      'El scoring combina valoración, antigüedad e interacciones registradas para ordenar las historias.',
    href: '/docs#moderacion',
    link: 'Entender la revisión y el orden',
  },
  {
    title: 'API y webhooks',
    description:
      'Consultá testimonios publicados desde tu aplicación y enviá eventos a un receptor HTTPS que configures.',
    href: '/docs#integraciones',
    link: 'Preparar una integración',
  },
];
export function FeaturesSection() {
  return (
    <section
      id="caracteristicas"
      aria-labelledby="features-title"
      className="scroll-mt-28 py-14 sm:py-20"
    >
      <div className="container">
        <h2
          id="features-title"
          className="max-w-2xl text-balance font-caption text-3xl font-light italic leading-tight sm:text-5xl"
        >
          Más contexto para tu equipo.
          <br />
          Más formas de compartir.
        </h2>
        <dl className="mt-10 grid gap-x-16 md:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="min-w-0 border-t py-6">
              <dt className="text-lg font-semibold">{feature.title}</dt>
              <dd className="mt-3 max-w-prose text-base leading-relaxed text-muted-foreground">
                {feature.description}
                <Link
                  href={feature.href}
                  className="mt-3 flex min-h-11 w-fit items-center text-sm text-primary underline underline-offset-4"
                >
                  {feature.link}
                </Link>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
