import type { ReactNode } from 'react';

/**
 * Purpose: Reserve the future dashboard route-group layout boundary.
 * Responsibilities: Reserve a route-group layout boundary without changing the current runtime behavior.
 * Inputs: Nested route children and future layout composition primitives.
 * Outputs: A transparent layout wrapper that preserves route rendering.
 * Dependencies: Future navigation, providers and dashboard layout components.
 * Implementation notes: Replace this stub when the route group is fully migrated to the new structure.
 * Naming and boundaries: Keep composition here and move reusable UI into components/layout.
 */
export default function DashboardRouteGroupLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <>{children}</>;
}
