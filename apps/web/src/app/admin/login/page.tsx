'use client';

import { useRouter } from 'next/navigation';
import { LoginForm } from '../../../components/login-form';
import { requestApi, SessionPayload } from '../../../lib/api';
import { saveSession } from '../../../lib/session-store';

export default function AdminLoginPage() {
  const router = useRouter();

  async function handleLogin(payload: { email: string; password: string }) {
    const response = await requestApi<SessionPayload>('/auth/login', {
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
      <div className="eyebrow">Login</div>
      <h1 style={{ margin: 0 }}>Entrar al dashboard</h1>
      <p className="notice">
        Podés usar las credenciales del seed (`admin@demo.com` / `Admin123!`) o las
        que generes al registrar un tenant nuevo.
      </p>
      <LoginForm onSubmit={handleLogin} />
    </section>
  );
}
