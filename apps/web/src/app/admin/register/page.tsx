'use client';

import { useRouter } from 'next/navigation';
import { RegisterAdminForm } from '@/components/register-admin-form';
import { requestApi, SessionPayload } from '@/lib/api';
import { saveSession } from '@/lib/session-store';

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
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr,1.2fr]">
      {/* Left Panel: Striking Identity */}
      <div className="relative hidden flex-col justify-between bg-foreground p-12 text-background lg:flex">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 bg-primary"></span>
          <span className="font-body text-xs font-bold uppercase tracking-widest text-primary">Testimonial CMS</span>
        </div>
        
        <div>
          <h1 className="font-caption text-6xl italic leading-tight text-background opacity-90 xl:text-7xl">
            Tu imperio <br /> <span className="font-body font-bold not-italic text-primary">Comienza.</span>
          </h1>
          <p className="mt-6 max-w-sm font-body text-sm font-light leading-relaxed opacity-60">
            Registrá tu tenant y obtené control absoluto sobre los testimonios que definen la autoridad de tu empresa.
          </p>
        </div>
        
        <div className="font-body text-xs uppercase tracking-widest opacity-40">
          © {new Date().getFullYear()} Testimonial CMS, LLC.
        </div>
      </div>

      {/* Right Panel: Minimal Form */}
      <div className="flex items-center justify-center bg-background p-8 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <span className="h-2 w-2 bg-primary inline-block mr-2"></span>
            <span className="font-body text-xs font-bold uppercase tracking-widest text-primary">Testimonial CMS</span>
          </div>
          
          <h2 className="mb-2 font-caption text-4xl text-foreground">Registro</h2>
          <p className="mb-8 font-body text-sm text-muted-foreground">
            Crearás tu espacio de trabajo y la cuenta administrativa base.
          </p>
          
          <RegisterAdminForm onSubmit={handleRegister} />
          
          <div className="mt-12 border-t pt-6 text-center">
            <p className="text-xs text-muted-foreground">
              ¿Ya tienes una cuenta? <a href="/admin/login" className="font-bold text-primary hover:underline">Ingresar al Dashboard</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
