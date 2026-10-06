'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Plus, RefreshCw, Trash2, Mail, ShieldAlert } from 'lucide-react';
import { createUser, deleteUser, listUsers } from '../api';
import { PageControls } from '@/features/shared/pagination';
import { actionFailureCopy, LoadFailure } from '@/features/shared/load-failure';
import { useRemoteResource } from '@/features/shared/use-remote-resource';

export type UserView = {
  id: string;
  tenantId: string;
  email: string;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  updatedAt: string;
};

export default function UsersPage() {
  const { session, fetchApi } = useSession();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => (await listUsers(fetchApi, page)).data, [fetchApi, page]);
  const { state, reload } = useRemoteResource(load, Boolean(session));
  const users: UserView[] = state.status === 'success' ? state.data.items : [];
  const total = state.status === 'success' ? state.data.meta.total : 0;

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateLoading(true);
    setActionError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const role = fd.get('role');
      if (role !== 'admin' && role !== 'editor') {
        setActionError('Elegí un rol válido.');
        return;
      }
      await createUser(fetchApi, {
        email: String(fd.get('email') ?? ''),
        password: String(fd.get('password') ?? ''),
        role,
      });
      setShowForm(false);
      reload();
    } catch (err) {
      setActionError(actionFailureCopy(err, 'la creación del usuario'));
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('¿Estás seguro de eliminar a este usuario?')) return;
    setActionError(null);
    try {
      await deleteUser(fetchApi, id);
      reload();
    } catch (err) {
      setActionError(actionFailureCopy(err, 'la eliminación del usuario'));
    }
  }

  if (!session?.user.roles.includes('admin')) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive mb-4" />
        <h2 className="font-body text-lg font-bold">Acceso Denegado</h2>
        <p className="text-muted-foreground">Solo administradores pueden ver esta sección.</p>
      </div>
    );
  }

  return (
    <>
      <DashboardHeader title="Usuarios" description="Gestiona los miembros de tu tenant.">
        <Button
          onClick={() => setShowForm(!showForm)}
          className="h-10 bg-primary px-6 font-body text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" /> Nuevo Usuario
        </Button>
        <Button
          variant="ghost"
          onClick={reload}
          className="h-10 font-body text-xs uppercase tracking-wider"
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refrescar
        </Button>
      </DashboardHeader>

      {actionError && <p role="alert" className="mb-6 border border-destructive p-4 font-body text-sm">{actionError}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 grid gap-4 border bg-card p-6 sm:grid-cols-4">
          <div className="grid gap-2 sm:col-span-1">
            <Label htmlFor="new-user-email" className="font-body text-xs font-bold uppercase tracking-widest">Email</Label>
            <Input id="new-user-email" name="email" type="email" required className="h-10 bg-transparent" placeholder="usuario@empresa.com" />
          </div>
          <div className="grid gap-2 sm:col-span-1">
            <Label htmlFor="new-user-password" className="font-body text-xs font-bold uppercase tracking-widest">Contraseña</Label>
            <Input id="new-user-password" name="password" type="password" required className="h-10 bg-transparent" placeholder="Mínimo 8 caracteres" minLength={8} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="new-user-role" className="font-body text-xs font-bold uppercase tracking-widest">Rol asignado</Label>
            <div className="flex gap-2">
              <select id="new-user-role" name="role" required className="h-10 border bg-transparent font-body text-sm px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring w-full">
                <option value="editor" className="text-black">Editor (Crear, Moderar, Publicar)</option>
                <option value="admin" className="text-black">Admin (Control Total)</option>
              </select>
              <Button type="submit" disabled={createLoading} className="h-10 px-8 bg-primary font-body text-xs uppercase tracking-wider text-primary-foreground">
                {createLoading ? 'Creando...' : 'Invitar'}
              </Button>
            </div>
          </div>
        </form>
      )}

      {state.status === 'loading' ? (
        <div className="flex items-center gap-3 py-20">
          <div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent" />
          <span className="font-body text-sm text-muted-foreground">Cargando...</span>
        </div>
      ) : state.status === 'error' ? (
        <LoadFailure error={state.error} resource="los usuarios" onRetry={reload} />
      ) : users.length === 0 ? (
        <div className="border border-dashed p-12 text-center">
          <p className="font-body text-sm text-muted-foreground">No hay usuarios en la plataforma.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email</th>
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rol Activo</th>
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estado</th>
                <th className="pb-3 text-right font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-foreground/5 transition-colors hover:bg-card">
                  <td className="py-4 pr-4 font-body text-sm font-medium text-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground"/> {u.email}
                  </td>
                  <td className="py-4 pr-4">
                    <div className="flex gap-1.5">
                      {u.roles.map((role) => (
                        <span key={role} className={cn(
                          'inline-block px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider',
                          role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-foreground/10 text-foreground/60'
                        )}>
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <span className={cn(
                      'inline-block px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider',
                      u.isActive ? 'bg-green-500/20 text-green-600' : 'bg-destructive/20 text-destructive'
                    )}>
                      {u.isActive ? 'Activo' : 'Suspendido'}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    {u.id !== session?.user.id && (
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(u.id)} aria-label={`Eliminar usuario ${u.email}`} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {state.status === 'success' && <PageControls page={page} total={total} limit={20} onChange={setPage} />}
    </>
  );
}
