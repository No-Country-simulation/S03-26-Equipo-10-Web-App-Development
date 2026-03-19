import Link from 'next/link';

export function HeroSection() {
  return (
    <section
      className="card"
      style={{
        padding: '3rem',
        display: 'grid',
        gap: '1.5rem',
        marginTop: '2rem',
      }}
    >
      <div className="eyebrow">Testimonial CMS</div>
      <div className="grid" style={{ gap: '0.5rem' }}>
        <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.75rem)', margin: 0 }}>
          Centralizá testimonios sin arrancar desde cero.
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--muted)', margin: 0 }}>
          El proyecto ya trae landing pública, base de admin protegida, API REST
          con NestJS y un dominio inicial conectado a Prisma.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link className="button" href="/admin">
          Abrir dashboard
        </Link>
        <Link className="button secondary" href="/admin/login">
          Revisar acceso admin
        </Link>
      </div>
    </section>
  );
}
