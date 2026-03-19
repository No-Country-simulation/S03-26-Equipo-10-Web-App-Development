const modules = [
  'Resumen de testimonios',
  'Moderación y estados de publicación',
  'Configuración de auth pendiente',
];

export default function AdminDashboardPage() {
  return (
    <section
      className="card"
      style={{
        padding: '2rem',
        marginTop: '1rem',
      }}
    >
      <div className="eyebrow">Dashboard</div>
      <h1>Panel admin listo para iterar</h1>
      <p style={{ color: 'var(--muted)', maxWidth: '60ch' }}>
        Esta vista queda detrás del middleware y sirve como base para conectar el
        login real, métricas y flujos CRUD del CMS.
      </p>
      <div className="grid" style={{ marginTop: '1rem' }}>
        {modules.map((item) => (
          <div
            key={item}
            style={{
              padding: '1rem',
              borderRadius: '18px',
              background: 'rgba(255,255,255,0.72)',
              border: '1px solid var(--border)',
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
