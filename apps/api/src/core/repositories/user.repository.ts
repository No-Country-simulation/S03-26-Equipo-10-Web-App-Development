export const USER_REPOSITORY = Symbol('IUserRepository');

export interface UserView {
  id: string;
  tenantId: string;
  email: string;
  isActive: boolean;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserRepository {
  findByTenant(tenantId: string): Promise<UserView[]>;
  findById(tenantId: string, userId: string): Promise<UserView | null>;
  findByEmail(email: string): Promise<UserView | null>;
  create(params: {
    tenantId: string;
    email: string;
    passwordHash: string;
    roleCode: string;
  }): Promise<UserView>;
  update(params: {
    tenantId: string;
    userId: string;
    email?: string;
    passwordHash?: string;
    isActive?: boolean;
  }): Promise<UserView>;
  remove(tenantId: string, userId: string): Promise<void>;
}
