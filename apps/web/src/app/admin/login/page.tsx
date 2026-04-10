'use client';

import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { requestApi, SessionPayload } from '@/lib/api';
import { saveSession } from '@/lib/session-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-sm text-xs font-bold uppercase tracking-wider">Login</span>
          </div>
          <CardTitle className="text-2xl">Entrar al dashboard</CardTitle>
          <CardDescription>
            Podés usar las credenciales del seed (`admin@demo.com` / `Admin123!`) o las que generes al registrar un tenant nuevo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm onSubmit={handleLogin} />
        </CardContent>
      </Card>
    </div>
  );
}
