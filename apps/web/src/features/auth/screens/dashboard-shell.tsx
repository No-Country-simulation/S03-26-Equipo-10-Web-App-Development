'use client';

import { useSession } from '@/hooks/use-session';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { session, loading, logout, isAdmin } = useSession();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin border-2 border-primary border-t-transparent" />
          <p className="font-body text-xs uppercase tracking-widest text-muted-foreground">
            Cargando panel...
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // useSession will redirect to /admin/login
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar
        userEmail={session.user.email}
        userRoles={session.user.roles}
        isAdmin={isAdmin}
        onLogout={logout}
      />
      <main className="pl-64">
        <div className="min-h-screen p-8 lg:p-12">
          {children}
        </div>
      </main>
    </div>
  );
}
