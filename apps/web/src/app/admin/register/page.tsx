'use client';

import { useRouter } from 'next/navigation';
import { RegisterAdminForm } from '@/components/register-admin-form';
import { requestApi, SessionPayload } from '@/lib/api';
import { saveSession } from '@/lib/session-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-sm text-xs font-bold uppercase tracking-wider">Registro</span>
          </div>
          <CardTitle className="text-2xl">Crear tenant + admin</CardTitle>
          <CardDescription>
            Este flujo crea el tenant, el primer usuario admin y devuelve tokens listos para entrar al dashboard sin pasos intermedios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterAdminForm onSubmit={handleRegister} />
        </CardContent>
      </Card>
    </div>
  );
}
