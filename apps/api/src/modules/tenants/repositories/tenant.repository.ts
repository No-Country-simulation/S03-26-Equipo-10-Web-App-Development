export const TENANT_REPOSITORY = Symbol('ITenantRepository');

export interface TenantView {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITenantRepository {
  findById(tenantId: string): Promise<TenantView | null>;
  update(tenantId: string, name: string): Promise<TenantView>;
  nameExists(name: string, excludeTenantId: string): Promise<boolean>;
}
