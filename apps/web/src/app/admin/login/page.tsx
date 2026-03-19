export default function AdminLoginPage({
  searchParams,
}: {
  searchParams?: { redirectTo?: string };
}) {
  const redirectTo = searchParams?.redirectTo ?? '/admin';

  return (
    <main className="shell">
      <section
        className="card"
        style={{
          padding: '2rem',
          maxWidth: '540px',
          margin: '4rem auto 0',
          display: 'grid',
          gap: '1rem',
        }}
      >
        <div className="eyebrow">Acceso demo</div>
        <h1 style={{ margin: 0 }}>Admin placeholder</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Este login crea una cookie local de desarrollo para poder trabajar el
          panel mientras se completa la autenticación real en NestJS.
        </p>
        <form action="/admin/login/session" method="post">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button type="submit">Entrar con sesión demo</button>
        </form>
      </section>
    </main>
  );
}
