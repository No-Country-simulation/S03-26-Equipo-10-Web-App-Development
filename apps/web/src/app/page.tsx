import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="shell">
      <section className="card" style={{ padding: '3rem', display: 'grid', gap: '1.5rem' }}>
        <div className="eyebrow">Testimonial CMS</div>
        <div className="grid" style={{ gap: '0.5rem' }}>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.75rem)', margin: 0 }}>
            Backend real de usuarios y login, con frontend mínimo para probarlo.
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--muted)', margin: 0 }}>
            Este flujo registra un tenant admin, genera JWT + refresh token, deja
            crear usuarios del tenant y muestra una vista básica del dashboard.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link className="button" href="/admin/login">
            Probar login
          </Link>
          <Link className="button secondary" href="/admin/register">
            Crear tenant admin
          </Link>
          <Link className="button secondary" href="/admin">
            Ir al dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
