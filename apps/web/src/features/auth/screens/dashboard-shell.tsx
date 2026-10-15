'use client';

import { useSession } from '@/hooks/use-session';
import { LoadingState } from '@/features/shared/feedback';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { session, loading, logout, isAdmin } = useSession();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <LoadingState>Cargando panel…</LoadingState>
      </main>
    );
  }

  if (!session) {
    return null; // useSession will redirect to /admin/login
  }

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-card focus:p-4 focus:font-body focus:text-foreground"
      >
        Saltar al contenido
      </a>
      <DashboardSidebar
        userEmail={session.user.email}
        userRoles={session.user.roles}
        isAdmin={isAdmin}
        onLogout={logout}
      />
      <main className="min-w-0 lg:pl-64" id="main-content" tabIndex={-1}>
        <div className="min-h-screen min-w-0 p-4 sm:p-8 lg:p-12">
          {children}
        </div>
      </main>
    </div>
  );
}
