export interface UserView {
  id: string;
  tenantId: string;
  email: string;
  isActive: boolean;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
}
