'use client';

import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { requestApi, SessionPayload } from '@/lib/api';
import { saveSession } from '@/lib/session-store';

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
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left Panel: Striking Identity */}
      <div className="relative hidden flex-col justify-between bg-foreground p-12 text-background lg:flex">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 bg-primary"></span>
          <span className="font-body text-xs font-bold uppercase tracking-widest text-primary">Testimonial CMS</span>
        </div>
        
        <div>
          <h1 className="font-caption text-6xl italic leading-tight text-background opacity-90 xl:text-7xl">
            Gestioná la <br /> <span className="font-body font-bold not-italic text-primary">Prueba Social.</span>
          </h1>
          <p className="mt-6 max-w-sm font-body text-sm font-light leading-relaxed opacity-60">
            Ingresá a tu panel para moderar testimonios, configurar integraciones y analizar métricas clave.
          </p>
        </div>
        
        <div className="font-body text-xs uppercase tracking-widest opacity-40">
          © {new Date().getFullYear()} Testimonial CMS, LLC.
        </div>
      </div>

      {/* Right Panel: Minimal Form */}
      <div className="flex items-center justify-center bg-background p-8 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <span className="h-2 w-2 bg-primary inline-block mr-2"></span>
            <span className="font-body text-xs font-bold uppercase tracking-widest text-primary">Testimonial CMS</span>
          </div>
          
          <h2 className="mb-2 font-caption text-4xl text-foreground">Ingreso</h2>
          <p className="mb-8 font-body text-sm text-muted-foreground">
            Podés usar <code className="bg-muted px-1 py-0.5 rounded text-foreground">admin@demo.com</code> / <code className="bg-muted px-1 py-0.5 rounded text-foreground">Admin123!</code>
          </p>
          
          <LoginForm onSubmit={handleLogin} />
          
          <div className="mt-12 border-t pt-6 text-center">
            <p className="text-xs text-muted-foreground">
              ¿No tienes una cuenta? <a href="/admin/register" className="font-bold text-primary hover:underline">Solicitar Acceso</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
