import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function loadFailureCopy(error: unknown, resource: string): { title: string; detail: string; retry?: boolean } {
  if (error instanceof ApiError) {
    if (error.status === 403) return { title: 'Acceso denegado', detail: `No tenés permiso para ver ${resource}.`, retry: false };
    if (error.status === 404) return { title: 'No encontrado', detail: `No encontramos ${resource}.`, retry: false };
    if (error.status === 429) return { title: 'Límite alcanzado', detail: 'Esperá un momento antes de volver a intentar.' };
    if (error.status === 401) return { title: 'Sesión vencida', detail: 'Volvé a iniciar sesión para continuar.', retry: false };
  }
  return { title: 'No se pudo cargar', detail: `No pudimos cargar ${resource}. Revisá tu conexión e intentá de nuevo.` };
}

export function actionFailureCopy(error: unknown, action: string) {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'No tenés permiso para realizar esta acción.';
    if (error.status === 404) return 'El recurso ya no está disponible. Actualizá la lista.';
    if (error.status === 409) return 'El recurso cambió o hay un conflicto. Actualizá la lista antes de decidir cómo seguir.';
    if (error.status === 429) return 'Alcanzaste el límite de solicitudes. Esperá antes de volver a intentar.';
    if (error.status === 400 || error.status === 422) return 'Revisá los datos ingresados y corregí el formulario.';
  }
  return `No pudimos confirmar si se completó ${action}. Actualizá la lista antes de repetir la acción.`;
}

export function LoadFailure({ error, resource, onRetry }: {
  error: unknown;
  resource: string;
  onRetry: () => void;
}) {
  const { title, detail, retry } = loadFailureCopy(error, resource);
  return (
    <div role="alert" className="border border-destructive/50 bg-card p-6">
      <h2 className="font-body text-sm font-bold text-foreground">{title}</h2>
      <p className="mt-2 font-body text-sm text-muted-foreground">{detail}</p>
      {retry !== false && <Button type="button" variant="outline" onClick={onRetry} className="mt-4">Reintentar</Button>}
    </div>
  );
}
