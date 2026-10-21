import DashboardShell from '@/features/auth/screens/dashboard-shell';
import PlatformBillingScreen from '@/features/billing/screens/platform-screen';
export default function Page() {
  return (
    <DashboardShell>
      <PlatformBillingScreen />
    </DashboardShell>
  );
}
