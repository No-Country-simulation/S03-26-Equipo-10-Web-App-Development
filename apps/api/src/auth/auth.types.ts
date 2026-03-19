export type AppRole = 'ADMIN' | 'EDITOR';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
}

export interface RequestWithUser extends Request {
  user?: AuthUser;
}
