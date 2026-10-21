import { Suspense } from 'react';
import BillingReturnScreen from '@/features/billing/screens/return-screen';
export default function Page() {
  return (
    <Suspense fallback={<p>Cargando confirmación…</p>}>
      <BillingReturnScreen />
    </Suspense>
  );
}
