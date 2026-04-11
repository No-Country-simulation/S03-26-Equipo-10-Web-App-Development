'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { TenantUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Plus, RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react';

export default function UsersPage() {
  const { session, fetchApi, isAdmin } = useSession();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchApi<TenantUser[]>('/users');
      setUsers(res.data);
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (session) void load(); }, [session]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const fd = new FormData(e.currentTarget);
    try {
      await fetchApi('/users', {
        method: 'POST',
        body: JSON.stringify({
          email: fd.get('email'),
          password: fd.get('password'),
          role: fd.get('role'),
        }),
      });
      setShowForm(false);
      void load();
    } finally {
      setCreating(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-destructive/50" />
          <p className="font-body text-sm uppercase tracking-widest text-muted-foreground">Acceso restringido a administradores</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <DashboardHeader title="Usuarios" description="Gestión de usuarios del tenant.">
        <Button onClick={() => setShowForm(!showForm)} className="h-10 bg-primary px-6 font-body text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Nuevo Usuario
        </Button>
        <Button variant="ghost" onClick={() => void load()} className="h-10 font-body text-xs uppercase tracking-wider">
          <RefreshCw className="mr-2 h-4 w-4" /> Refrescar
        </Button>
      </DashboardHeader>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 grid gap-4 border bg-card p-6 sm:grid-cols-4">
          <div className="grid gap-2">
            <Label className="font-body text-[10px] font-bold uppercase tracking-widest">Email</Label>
            <Input name="email" type="email" required className="h-10 bg-transparent" placeholder="user@empresa.com" />
          </div>
          <div className="grid gap-2">
            <Label className="font-body text-[10px] font-bold uppercase tracking-widest">Contraseña</Label>
            <Input name="password" type="password" required className="h-10 bg-transparent" placeholder="••••••••" />
          </div>
          <div className="grid gap-2">
            <Label className="font-body text-[10px] font-bold uppercase tracking-widest">Rol</Label>
            <select name="role" className="h-10 border bg-transparent px-3 font-body text-sm text-foreground">
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={creating} className="h-10 w-full bg-primary font-body text-xs uppercase tracking-wider text-primary-foreground">
              {creating ? 'Creando...' : 'Crear'}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center gap-3 py-20">
          <div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email</th>
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Roles</th>
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estado</th>
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Creado</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-foreground/5 transition-colors hover:bg-card">
                  <td className="py-4 pr-4 font-body text-sm text-foreground">{u.email}</td>
                  <td className="py-4 pr-4">
                    <div className="flex gap-1.5">
                      {u.roles.map((r) => (
                        <span key={r} className={cn('inline-flex items-center gap-1 px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider', r === 'admin' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground')}>
                          <ShieldCheck className="h-3 w-3" /> {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <span className={cn('px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider', u.isActive ? 'bg-primary/10 text-primary' : 'bg-destructive/20 text-destructive')}>
                      {u.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-4 font-body text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
