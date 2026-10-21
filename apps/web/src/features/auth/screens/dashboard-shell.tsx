'use client';

import { useSession } from '@/hooks/use-session';
import { LoadingState } from '@/features/shared/feedback';
import {
  WorkspaceIdentityProvider,
  useWorkspaceIdentity,
} from '@/features/shared/workspace-identity';
import {
  BillingScope,
  BillingNotice,
  useBillingScope,
} from '@/features/billing/components/billing-scope';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';

function WorkspaceSidebar(
  props: React.ComponentProps<typeof DashboardSidebar>,
) {
  const identity = useWorkspaceIdentity();
  const billing = useBillingScope();
  return (
    <DashboardSidebar
      {...props}
      workspaceName={identity?.name}
      isOperator={billing?.isOperator ?? false}
    />
  );
}

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { session, loading, logout, isAdmin, fetchApi } = useSession();

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
    <WorkspaceIdentityProvider
      key={`${session.user.tenantId}:${session.user.tenantName}`}
      name={session.user.tenantName}
    >
      <BillingScope fetchApi={fetchApi} enabled={!!session}>
        <div className="min-h-screen bg-background">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-card focus:p-4 focus:font-body focus:text-foreground"
          >
            Saltar al contenido
          </a>
          <WorkspaceSidebar
            userEmail={session.user.email}
            userRoles={session.user.roles}
            isAdmin={isAdmin}
            onLogout={logout}
          />
          <main className="min-w-0 lg:pl-64" id="main-content" tabIndex={-1}>
            <div className="min-h-screen min-w-0 p-4 sm:p-8 lg:p-12">
              <BillingNotice />
              {children}
            </div>
          </main>
        </div>
      </BillingScope>
    </WorkspaceIdentityProvider>
  );
}
