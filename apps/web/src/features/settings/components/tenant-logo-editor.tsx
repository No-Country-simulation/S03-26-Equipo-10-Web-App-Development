'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TenantLogo } from '@/features/shared/tenant-logo';
import { ApiError } from '@/lib/api';
import type { SessionFetch } from '@/lib/api/validated-response';
import { removeTenantLogo, uploadTenantLogo } from '../api';

export function TenantLogoEditor({ tenantId, name, logoUrl, fetchApi, onSaved }: {
  tenantId: string; name: string; logoUrl: string | null; fetchApi: SessionFetch; onSaved: () => void;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savedLogo, setSavedLogo] = useState<{ url: string | null } | null>(null);
  const reader = useRef<FileReader | null>(null);
  const generation = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    generation.current += 1;
    if (reader.current?.readyState === FileReader.LOADING) reader.current.abort();
  }, [tenantId]);

  const currentLogo = savedLogo ? savedLogo.url : logoUrl;
  const busy = reading || saving;

  function selectFile(file: File | undefined) {
    const version = ++generation.current;
    if (reader.current?.readyState === FileReader.LOADING) reader.current.abort();
    setError(null);
    setMessage(null);
    setImage(null);
    setReading(false);
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || !file.size || file.size > 2 * 1024 * 1024) {
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
    if (busy || (!remove && !image)) return;
    const version = generation.current;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = remove ? await removeTenantLogo(fetchApi) : await uploadTenantLogo(fetchApi, image!);
      if (generation.current !== version) return;
      setSavedLogo({ url: response.data.logoUrl });
      setImage(null);
      if (fileInput.current) fileInput.current.value = '';
      setMessage(remove ? 'Logo eliminado.' : 'Logo guardado. Ya se muestra en tu formulario público.');
      onSaved();
    } catch (failure) {
      if (generation.current !== version) return;
      setError(failure instanceof ApiError && failure.status === 409
        ? 'El logo cambió mientras lo guardabas. Refrescá la configuración y volvé a intentar.'
        : failure instanceof ApiError && failure.status === 503
          ? 'El almacenamiento de imágenes no está disponible. Conservamos tu selección para reintentar.'
          : 'No pudimos confirmar el cambio del logo. Refrescá para verificarlo; conservamos tu selección.');
    } finally {
      if (generation.current === version) setSaving(false);
    }
  }

  return (
    <section className="border p-6" aria-labelledby="tenant-logo-title" aria-busy={busy}>
      <h2 id="tenant-logo-title" className="mb-4 font-body text-xs font-bold uppercase tracking-widest">Logo de la empresa</h2>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <TenantLogo name={name} logoUrl={image ?? currentLogo} />
        <div className="min-w-0 flex-1">
          <p id="tenant-logo-help" className="mb-3 font-body text-sm text-muted-foreground">
            Se muestra junto al nombre en tu formulario público. PNG, JPEG o WebP, hasta 2 MiB.
          </p>
          <label htmlFor="tenant-logo-file" className="mb-2 block font-body text-xs font-bold uppercase tracking-wider">Seleccioná una imagen</label>
          <input ref={fileInput} id="tenant-logo-file" type="file" accept="image/png,image/jpeg,image/webp"
            aria-describedby="tenant-logo-help" disabled={busy} onChange={event => selectFile(event.target.files?.[0])}
            className="block w-full max-w-full font-body text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" disabled={busy || !image} onClick={() => void save(false)}>
              {saving ? 'Guardando...' : 'Guardar logo'}
            </Button>
            <Button type="button" variant="outline" disabled={busy || !currentLogo} onClick={() => void save(true)}>Eliminar logo</Button>
          </div>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 font-body text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="mt-4 font-body text-sm">{message}</p>}
    </section>
  );
}
