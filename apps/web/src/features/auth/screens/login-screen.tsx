'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/features/auth/components/login-form';
import { AuthPageLayout } from '../components/auth-page-layout';
import { login } from '../api';
import { clearLegacySession } from '@/lib/session-store';

export default function AdminLoginPage() {
  const router = useRouter();
  async function handleLogin(payload: { email: string; password: string }) {
    await login(payload);
    clearLegacySession();
    router.push('/admin');
  }
  return (
    <AuthPageLayout
      title="Iniciar sesión"
      introduction="Ingresá con tu cuenta para trabajar en el panel de tu espacio."
      sideTitle={
        <>
          Gestioná la <br />
          <span className="font-body font-bold not-italic text-primary">
            prueba social.
          </span>
        </>
      }
      sideDescription="Revisá testimonios, decidí cuáles publicar y seguí la actividad de tu espacio."
      footer={
        <>
          ¿Todavía no tenés un espacio?{' '}
          <Link
            href="/admin/register"
            className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Creá tu espacio
          </Link>
        </>
      }
    >
      <LoginForm onSubmit={handleLogin} />
    </AuthPageLayout>
  );
}
