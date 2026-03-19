import { HeroSection } from '@/components/hero-section';

const checklist = [
  'Next.js App Router listo para la landing y el panel admin.',
  'NestJS con healthcheck, auth placeholder y módulo de testimonios.',
  'Postgres + Prisma listos para migraciones y seed local.',
];

export default function HomePage() {
  return (
    <main className="shell">
      <HeroSection />
      <section
        className="card"
        style={{
          padding: '2rem',
          marginTop: '1.5rem',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Qué incluye este arranque</h2>
        <div className="grid">
          {checklist.map((item) => (
            <article
              key={item}
              style={{
                padding: '1rem 1.1rem',
                borderRadius: '18px',
                background: 'rgba(255, 255, 255, 0.72)',
                border: '1px solid var(--border)',
              }}
            >
              {item}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
