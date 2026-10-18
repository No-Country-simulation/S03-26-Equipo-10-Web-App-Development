'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TenantLogo } from '@/features/shared/tenant-logo';
import { ApiError } from '@/lib/api';
import type { SessionFetch } from '@/lib/api/validated-response';
import { removeTenantLogo, uploadTenantLogo, type TenantInfo } from '../api';
import { useActionConfirmation } from '@/features/shared/use-action-confirmation';

export function TenantLogoEditor({
  tenantId,
  name,
  logoUrl,
  fetchApi,
  onSaved,
  onMutationStart,
  onMutationEnd,
}: {
  tenantId: string;
  name: string;
  logoUrl: string | null;
  fetchApi: SessionFetch;
  onSaved: (tenant: TenantInfo) => void;
  onMutationStart?: () => void;
  onMutationEnd?: () => void;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savedLogo, setSavedLogo] = useState<{ url: string | null } | null>(
    null,
  );
  const reader = useRef<FileReader | null>(null);
  const lock = useRef(false);
  const confirmation = useActionConfirmation();
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    setSavedLogo(null);
  }, [logoUrl]);
  const generation = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      generation.current += 1;
      if (reader.current?.readyState === FileReader.LOADING)
        reader.current.abort();
    },
    [tenantId],
  );

  const currentLogo = savedLogo ? savedLogo.url : logoUrl;
  const busy = reading || saving;

  function selectFile(file: File | undefined) {
    const version = ++generation.current;
    if (reader.current?.readyState === FileReader.LOADING)
      reader.current.abort();
    setError(null);
    setMessage(null);
    setImage(null);
    setReading(false);
    if (!file) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      !file.size ||
      file.size > 2 * 1024 * 1024
    ) {
      setError('Elegí una imagen PNG, JPEG o WebP de hasta 2 MiB.');
      return;
    }
    const nextReader = new FileReader();
    reader.current = nextReader;
    setReading(true);
    nextReader.onload = () => {
      if (generation.current !== version) return;
      setReading(false);
      if (typeof nextReader.result === 'string') setImage(nextReader.result);
      else setError('No pudimos leer la imagen. Elegí otro archivo.');
    };
    nextReader.onerror = () => {
      if (generation.current !== version) return;
      setReading(false);
      setError('No pudimos leer la imagen. Elegí otro archivo.');
    };
    nextReader.readAsDataURL(file);
  }

  async function save(remove: boolean) {
    if (lock.current || busy || (!remove && !image)) return;
    lock.current = true;
    onMutationStart?.();
    const version = generation.current;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = remove
        ? await removeTenantLogo(fetchApi)
        : await uploadTenantLogo(fetchApi, image!);
      if (generation.current !== version) return;
      if (response.data.id !== tenantId)
        throw new ApiError('Respuesta de otro espacio.', 'INVALID_RESPONSE');
      setSavedLogo({ url: response.data.logoUrl });
      setImage(null);
      if (fileInput.current) fileInput.current.value = '';
      setMessage(
        remove
          ? 'Logo eliminado.'
          : 'Logo guardado. Ya se muestra en tu formulario público.',
      );
      onSaved(response.data);
      if (!remove)
        requestAnimationFrame(() => {
          if (
            document.activeElement === document.body ||
            fileInput.current
              ?.closest('section')
              ?.contains(document.activeElement)
          )
            feedback.current?.focus();
        });
    } catch (failure) {
      if (generation.current !== version) return;
      setError(
        failure instanceof ApiError && failure.status === 409
          ? 'El logo cambió mientras lo guardabas. Refrescá la configuración y volvé a intentar.'
          : failure instanceof ApiError && failure.status === 503
            ? 'El almacenamiento de imágenes no está disponible. Conservamos tu selección para reintentar.'
            : 'No pudimos confirmar el cambio del logo. Refrescá para verificarlo; conservamos tu selección.',
      );
    } finally {
      lock.current = false;
      onMutationEnd?.();
      if (generation.current === version) setSaving(false);
    }
  }

  return (
    <section
      className="border p-6"
      aria-labelledby="tenant-logo-title"
      aria-busy={busy}
    >
      <h2
        id="tenant-logo-title"
        className="mb-4 font-body text-xs font-bold uppercase tracking-widest"
      >
        Logo de la empresa
      </h2>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <TenantLogo name={name} logoUrl={image ?? currentLogo} />
        <div className="min-w-0 flex-1">
          <p
            id="tenant-logo-help"
            className="mb-3 font-body text-sm text-muted-foreground"
          >
            Se muestra junto al nombre en las páginas públicas. PNG, JPEG o
            WebP, hasta 2 MiB.
          </p>
          <label
            htmlFor="tenant-logo-file"
            className="mb-2 block font-body text-xs font-bold uppercase tracking-wider"
          >
            Seleccioná una imagen
          </label>
          <input
            ref={fileInput}
            id="tenant-logo-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-describedby="tenant-logo-help"
            disabled={busy}
            onChange={(event) => selectFile(event.target.files?.[0])}
            className="block w-full max-w-full font-body text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={busy || !image}
              onClick={() => void save(false)}
            >
              {saving ? 'Guardando...' : 'Guardar logo'}
            </Button>
            {image && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setImage(null);
                  setError(null);
                  if (fileInput.current) fileInput.current.value = '';
                  fileInput.current?.focus();
                }}
              >
                Descartar selección
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={busy || !currentLogo || Boolean(image)}
              onClick={() =>
                confirmation.confirm({
                  title: 'Eliminar logo del espacio',
                  description: `Se quitará el logo de ${name}. Se mostrarán sus iniciales junto al nombre. Los testimonios y enlaces se conservan. Podés cancelar antes de confirmar.`,
                  confirmLabel: 'Confirmar eliminación',
                  task: 'la eliminación del logo',
                  action: () => save(true),
                })
              }
            >
              Eliminar logo
            </Button>
          </div>
        </div>
      </div>
      {image && (
        <p className="mt-4 font-body text-sm">
          Vista previa sin guardar. Guardá o descartá la selección antes de
          eliminar el logo actual.
        </p>
      )}
      {confirmation.dialog}
      {error && (
        <p role="alert" className="mt-4 font-body text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p
          ref={feedback}
          tabIndex={-1}
          role="status"
          className="mt-4 font-body text-sm"
        >
          {message}
        </p>
      )}
    </section>
  );
}
