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
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <strong>Admin demo</strong>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)' }}>
            El frontend es deliberadamente simple para validar el flujo end-to-end.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link className="button secondary" href="/admin/register">
            Registrar tenant
          </Link>
          <Link className="button secondary" href="/admin/login">
            Login
          </Link>
          <Link className="button secondary" href="/">
            Inicio
          </Link>
        </div>
      </section>
      {children}
    </main>
  );
}
