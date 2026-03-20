'use client';

import { useRouter } from 'next/navigation';
import { RegisterAdminForm } from '../../../components/register-admin-form';
import { requestApi, SessionPayload } from '../../../lib/api';
import { saveSession } from '../../../lib/session-store';

export default function AdminRegisterPage() {
  const router = useRouter();

  async function handleRegister(payload: {
    tenantName: string;
    email: string;
    password: string;
  }) {
    const response = await requestApi<SessionPayload>('/auth/register-admin', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    saveSession(response.data);
    router.push('/admin');
  }

  return (
    <section
      className="card"
      style={{
        padding: '2rem',
        maxWidth: '560px',
        margin: '2rem auto 0',
        display: 'grid',
        gap: '1rem',
      }}
    >
      <div className="eyebrow">Registro</div>
      <h1 style={{ margin: 0 }}>Crear tenant + admin</h1>
      <p className="notice">
        Este endpoint crea el tenant, el primer usuario admin y devuelve tokens
        listos para entrar al dashboard sin pasos intermedios.
      </p>
      <RegisterAdminForm onSubmit={handleRegister} />
    </section>
  );
}
