import type { ReactNode } from 'react';
/** Legacy URLs resolve to the active admin shell in their page redirects. */
export default function LegacyAliasLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <>{children}</>;
}
