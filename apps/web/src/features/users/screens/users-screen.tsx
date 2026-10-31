'use client';
import { BillingQuotaNote } from '@/features/billing/components/billing-scope';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, RefreshCw } from 'lucide-react';
import {
  createUser,
  deleteUser,
  listUsers,
  setUserActive,
  type CreateUserInput,
} from '../api';
import { PageControls } from '@/features/shared/pagination';
import { actionFailureCopy, LoadFailure } from '@/features/shared/load-failure';
import { LoadingState, ActionFeedback } from '@/features/shared/feedback';
import { useActionConfirmation } from '@/features/shared/use-action-confirmation';
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
const emptyDraft: CreateUserInput = { email: '', password: '', role: 'editor' };
export default function UsersPage() {
  const { session, fetchApi } = useSession();
  const isAdmin = session?.user.roles.includes('admin') ?? false;
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<CreateUserInput>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const confirmation = useActionConfirmation();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const load = useCallback(
    async () => (await listUsers(fetchApi, page)).data,
    [fetchApi, page],
  );
  const { state, reload } = useRemoteResource(load, isAdmin);
  const users: UserView[] = state.status === 'success' ? state.data.items : [];
  useEffect(() => {
    if (state.status === 'success') {
      const last = Math.max(1, Math.ceil(state.data.meta.total / 20));
      if (page > last) setPage(last);
    }
  }, [state, page]);
  useEffect(() => {
    if (showForm) emailRef.current?.focus();
  }, [showForm]);
  function closeForm() {
    if (lock.current) return;
    const close = () => {
      setShowForm(false);
      setDraft(emptyDraft);
      setActionError(null);
    };
    if (draft.email || draft.password || draft.role !== 'editor')
      confirmation.confirm({
        title: 'Descartar la creación del usuario',
        description:
          'Los datos que todavía no guardaste se perderán. La cuenta no fue creada.',
        confirmLabel: 'Descartar cambios',
        task: 'el cierre del formulario',
        destructive: false,
        action: async () => close(),
      });
    else close();
  }
  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError(null);
    setSuccessMessage(null);
    try {
      await createUser(fetchApi, { ...draft, email: draft.email.trim() });
      setDraft(emptyDraft);
      setShowForm(false);
      setPage(1);
      setSuccessMessage(
        'Usuario creado. La cuenta ya puede iniciar sesión; no se envió una invitación.',
      );
      reload();
    } catch (error) {
      setActionError(actionFailureCopy(error, 'la creación del usuario'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function confirmUser(user: UserView, action: 'delete' | 'toggle') {
    if (lock.current || user.id === session?.user.id) return;
    const isActive = !user.isActive;
    const label =
      action === 'delete'
        ? 'Eliminar usuario'
        : isActive
          ? 'Activar usuario'
          : 'Desactivar usuario';
    confirmation.confirm({
      title: `${label}: ${user.email}`,
      confirmLabel: label,
      task:
        action === 'delete'
          ? 'la eliminación del usuario'
          : 'el cambio de acceso',
      destructive: action === 'delete' || !isActive,
      description:
        action === 'delete'
          ? `Vas a eliminar la cuenta ${user.email} de este espacio. El borrado es definitivo y puede impedirse si tiene historial asociado; podés desactivarla para retirar su acceso.`
          : isActive
            ? `La cuenta ${user.email} podrá iniciar sesión y usar sesiones todavía vigentes con sus mismos roles.`
            : `Mientras la cuenta ${user.email} esté desactivada, no podrá iniciar sesión ni usar sus sesiones actuales. Al reactivarla, las sesiones todavía válidas podrán volver a funcionar.`,
      action: async () => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setActionError(null);
        setSuccessMessage(null);
        try {
          if (action === 'delete') {
            await deleteUser(fetchApi, user.id);
            setSuccessMessage('Usuario eliminado.');
          } else {
            await setUserActive(fetchApi, user.id, isActive);
            setSuccessMessage(
              `Usuario ${isActive ? 'activado' : 'desactivado'}: ${user.email}.`,
            );
          }
          reload();
        } finally {
          lock.current = false;
          setBusy(false);
        }
      },
    });
  }
  if (!session) return <LoadingState>Cargando acceso…</LoadingState>;
  if (!isAdmin)
    return (
      <ActionFeedback>
        <h2 className="font-body text-lg font-medium">Acceso denegado</h2>
        <p className="mt-2">Sólo administradores pueden gestionar usuarios.</p>
      </ActionFeedback>
    );
  return (
    <>
      <DashboardHeader
        title="Usuarios"
        description="Administrá las cuentas y el acceso a este espacio."
      >
        <Button
          type="button"
          disabled={busy}
          onClick={() => (showForm ? closeForm() : setShowForm(true))}
        >
          <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
          {showForm ? 'Cerrar formulario' : 'Nuevo usuario'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={reload}
        >
          <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
          Refrescar
        </Button>
      </DashboardHeader>
      <BillingQuotaNote quota="active_users" />
      {successMessage && (
        <ActionFeedback kind="success">{successMessage}</ActionFeedback>
      )}
      {actionError && (
        <ActionFeedback>
          <p id="user-form-error">{actionError}</p>
        </ActionFeedback>
      )}
      {showForm && (
        <form
          onSubmit={(event) => void handleCreate(event)}
          className="mb-8 space-y-5 border bg-card p-6"
          aria-busy={busy}
        >
          <div>
            <h2 className="font-body text-lg font-medium">Crear usuario</h2>
            <p className="mt-2 max-w-prose font-body text-sm text-muted-foreground">
              Creás una cuenta con acceso inmediato. No se envía una invitación
              por email. Acordá con la persona cómo recibirá su contraseña.
            </p>
          </div>
          <fieldset
            disabled={busy}
            className="grid min-w-0 gap-5 sm:grid-cols-2"
          >
            <div className="min-w-0 space-y-2">
              <Label htmlFor="new-user-email">Email</Label>
              <Input
                ref={emailRef}
                id="new-user-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={draft.email}
                onChange={(event) =>
                  setDraft({ ...draft, email: event.target.value })
                }
                aria-describedby={actionError ? 'user-form-error' : undefined}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="new-user-password">Contraseña</Label>
              <Input
                id="new-user-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}"
                value={draft.password}
                onChange={(event) =>
                  setDraft({ ...draft, password: event.target.value })
                }
                aria-describedby={`user-password-help${actionError ? ' user-form-error' : ''}`}
              />
              <p
                id="user-password-help"
                className="font-body text-sm text-muted-foreground"
              >
                De 8 a 72 caracteres, con mayúscula, minúscula, número y
                símbolo.
              </p>
            </div>
            <div className="min-w-0 space-y-2 sm:col-span-2">
              <Label htmlFor="new-user-role">Rol asignado al crear</Label>
              <select
                id="new-user-role"
                name="role"
                className="min-h-11 w-full min-w-0 border bg-background px-3 font-body text-base md:text-sm"
                value={draft.role}
                onChange={(event) => {
                  if (
                    event.target.value === 'admin' ||
                    event.target.value === 'editor'
                  )
                    setDraft({ ...draft, role: event.target.value });
                }}
                aria-describedby="user-role-help"
              >
                <option value="editor">Editor</option>
                <option value="admin">Administrador</option>
              </select>
              <p
                id="user-role-help"
                className="max-w-prose font-body text-sm text-muted-foreground"
              >
                {draft.role === 'editor'
                  ? 'Puede crear, moderar y publicar testimonios, gestionar categorías y etiquetas y consultar analítica e inteligencia de negocio. Edita contenido propio que no esté publicado.'
                  : 'Administra testimonios, usuarios, configuración e integraciones del espacio. Puede editar contenido ajeno que no esté publicado.'}{' '}
                El acceso depende de las capacidades habilitadas.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <Button type="submit">
                {busy ? 'Creando…' : 'Crear usuario'}
              </Button>
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancelar
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {state.status === 'loading' ? (
        <LoadingState>Cargando usuarios…</LoadingState>
      ) : state.status === 'error' ? (
        <LoadFailure
          error={state.error}
          resource="los usuarios"
          onRetry={reload}
        />
      ) : users.length === 0 ? (
        <p className="border border-dashed p-8 font-body text-sm">
          No hay usuarios en esta página.
        </p>
      ) : (
        <div>
          <p className="mb-3 font-body text-sm text-muted-foreground md:hidden">
            Desplazá la tabla horizontalmente para ver las acciones de cada
            cuenta.
          </p>
          <div
            role="region"
            aria-label="Tabla de usuarios"
            tabIndex={0}
            className="min-w-0 overflow-x-auto"
          >
            <table className="min-w-[640px] w-full font-body text-sm">
              <caption className="sr-only">Usuarios de este espacio</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="py-3 pr-4 text-left">
                    Email
                  </th>
                  <th scope="col" className="py-3 pr-4 text-left">
                    Roles
                  </th>
                  <th scope="col" className="py-3 pr-4 text-left">
                    Acceso
                  </th>
                  <th scope="col" className="py-3 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="max-w-xs break-words py-4 pr-4">
                      {user.email}
                      {user.id === session.user.id && (
                        <span className="mt-1 block text-muted-foreground">
                          Tu cuenta
                        </span>
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      {user.roles
                        .map((role) =>
                          role === 'admin'
                            ? 'Administrador'
                            : role === 'editor'
                              ? 'Editor'
                              : role,
                        )
                        .join(', ')}
                    </td>
                    <td className="py-4 pr-4">
                      <span
                        className={
                          user.isActive
                            ? 'text-success'
                            : 'text-muted-foreground'
                        }
                      >
                        {user.isActive ? 'Activo' : 'Desactivado'}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      {user.id === session.user.id ? (
                        <span className="text-muted-foreground">
                          La gestión propia está protegida
                        </span>
                      ) : (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            aria-label={`${user.isActive ? 'Desactivar' : 'Activar'} usuario ${user.email}`}
                            onClick={() => confirmUser(user, 'toggle')}
                          >
                            {user.isActive ? 'Desactivar' : 'Activar'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            className="text-destructive"
                            aria-label={`Eliminar usuario ${user.email}`}
                            onClick={() => confirmUser(user, 'delete')}
                          >
                            Eliminar
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {state.status === 'success' && (
        <fieldset disabled={busy} className="min-w-0">
          <PageControls
            page={page}
            total={state.data.meta.total}
            limit={20}
            onChange={setPage}
          />
        </fieldset>
      )}
      {confirmation.dialog}
    </>
  );
}
