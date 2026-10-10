import { Suspense } from 'react';
import BiScreen from '@/features/business-intelligence/screens/bi-screen';

export default function Page() {
  return <Suspense fallback={<p role="status">Cargando inteligencia de negocio…</p>}><BiScreen /></Suspense>;
}
