'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RegisterAdminForm } from '@/features/auth/components/register-admin-form';
import { AuthPageLayout } from '../components/auth-page-layout';
import { registerAdmin } from '../api';
import { clearLegacySession } from '@/lib/session-store';

export default function AdminRegisterPage() {
  const router = useRouter();
  async function handleRegister(payload: {
    tenantName: string;
    email: string;
    password: string;
  }) {
    await registerAdmin(payload);
    clearLegacySession();
    router.push('/admin');
  }
  return (
    <AuthPageLayout
      title="Crear tu espacio"
      introduction="Creá el espacio de tu organización y su primera cuenta administradora. Al terminar, vas a ingresar al panel."
      sideTitle={
        <>
          Dale voz a <br />
          <span className="font-body font-bold not-italic text-primary">
            tus clientes.
          </span>
        </>
      }
      sideDescription="Reuní testimonios, revisá su contenido y elegí cuáles mostrar en tu galería pública."
      footer={
        <>
          ¿Ya tenés una cuenta?{' '}
          <Link
            href="/admin/login"
            className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Iniciá sesión
          </Link>
        </>
      }
    >
      <RegisterAdminForm onSubmit={handleRegister} />
    </AuthPageLayout>
  );
}
