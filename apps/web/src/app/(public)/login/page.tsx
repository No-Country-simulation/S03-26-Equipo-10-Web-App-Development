import { redirect } from 'next/navigation';

export default function LegacyAliasPage() {
  redirect('/admin/login');
}
