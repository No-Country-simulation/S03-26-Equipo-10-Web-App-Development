import Link from 'next/link';

export function BenefitsSection() {
  return (
    <section
      id="producto"
      aria-labelledby="product-title"
      className="scroll-mt-28 py-14 sm:py-20"
    >
      <div className="container grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <h2
          id="product-title"
          className="max-w-xl text-balance font-caption text-3xl font-light leading-tight sm:text-5xl"
        >
          Las historias de tus clientes,
          <br />
          <em className="text-primary">con criterio editorial.</em>
        </h2>
        <div className="max-w-prose space-y-5 text-base leading-relaxed text-muted-foreground">
          <p>
            Centralizá la recepción y la revisión. Las categorías y etiquetas
            ayudan a encontrar cada testimonio; los roles de administrador y
            editor definen las acciones disponibles.
          </p>
          <p>
            Recibir una historia no la hace pública. Tu equipo la revisa y
            decide cuándo compartirla en la galería.
          </p>
          <Link
            href="/docs#moderacion"
            className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
          >
            Conocé el proceso de moderación
          </Link>
        </div>
      </div>
    </section>
  );
}
