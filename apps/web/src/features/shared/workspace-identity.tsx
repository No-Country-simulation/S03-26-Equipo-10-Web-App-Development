'use client';

import { createContext, useContext, useState } from 'react';

const WorkspaceIdentity = createContext<{
  name: string;
  rename: (name: string) => void;
} | null>(null);

export function WorkspaceIdentityProvider({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  const [confirmedName, rename] = useState(name);
  return (
    <WorkspaceIdentity.Provider value={{ name: confirmedName, rename }}>
      {children}
    </WorkspaceIdentity.Provider>
  );
}
export const useWorkspaceIdentity = () => useContext(WorkspaceIdentity);
