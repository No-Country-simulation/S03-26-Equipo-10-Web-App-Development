import Link from 'next/link';

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="shell">
      <section
        className="card"
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '1rem',
        }}
      >
        <div>
          <strong>Admin</strong>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)' }}>
            Base protegida para el dashboard del CMS.
          </p>
        </div>
        <Link className="button secondary" href="/">
          Volver al sitio
        </Link>
      </section>
      {children}
    </main>
  );
}
