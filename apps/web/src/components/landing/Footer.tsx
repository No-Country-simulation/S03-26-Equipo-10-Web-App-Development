import Link from 'next/link';
const links = [
  {
    label: 'Producto',
    items: [
      ['Características', '/#caracteristicas'],
      ['Cómo funciona', '/#como-funciona'],
      ['Crear un espacio', '/admin/register'],
    ],
  },
  {
    label: 'Ayuda',
    items: [
      ['Captura y moderación', '/docs#captura'],
      ['Publicación', '/docs#publicacion'],
      ['API keys', '/docs#api-keys'],
      ['Webhooks', '/docs#webhooks'],
    ],
  },
];
export function Footer() {
  return (
    <footer className="border-t py-10 sm:py-14">
      <div className="container">
        <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_1fr_1fr]">
          <div className="min-w-0">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center text-base font-semibold"
            >
              Testimonial CMS
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Un espacio para recibir, revisar y publicar testimonios de
              clientes.
            </p>
          </div>
          {links.map((group) => (
            <nav key={group.label} aria-label={group.label}>
              <h2 className="text-base font-semibold">{group.label}</h2>
              <ul className="mt-3">
                {group.items.map(([label, href]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-8 border-t pt-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Testimonial CMS
        </p>
      </div>
    </footer>
  );
}
