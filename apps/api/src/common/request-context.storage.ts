import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestContext } from './interfaces/auth-context.interface';

export interface RequestScope extends RequestContext {
  /** Se asigna únicamente después de verificar una credencial. */
  tenantId?: string;
}

const storage = new AsyncLocalStorage<RequestScope>();

export function runWithRequestScope<T>(scope: RequestScope, callback: () => T): T {
  return storage.run(scope, callback);
}

export function getRequestScope(): RequestScope | undefined {
  return storage.getStore();
}

export function setAuthenticatedTenant(tenantId: string): void {
  const scope = storage.getStore();
  if (scope) scope.tenantId = tenantId;
}
