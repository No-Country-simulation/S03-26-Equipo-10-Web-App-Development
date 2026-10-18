'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Star, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NoiseOverlay } from '@/components/ui/NoiseOverlay';
import { ApiError } from '@/lib/api';
import { loadFailureCopy } from '@/features/shared/load-failure';
import {
  getFormInfo,
  submitPublicTestimonial,
  type PublicSubmissionResult,
} from '../api';
import { TenantLogo } from '@/features/shared/tenant-logo';
import { youtubeVideoId } from '@/features/shared/public-media';

type FormInfo = {
  name: string;
  isPublicFormEnabled: boolean;
  logoUrl: string | null;
};
type FormState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; info: FormInfo };
function submissionErrorCopy(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'PUBLIC_SUBMISSION_RECENT_BROWSER')
      return 'Este navegador tiene una marca de envío reciente. Este intento no se guardó; intentá más adelante.';
    if (error.status === 429)
      return 'Alcanzaste el límite de envíos. Esperá antes de volver a intentar; este intento no se guardó.';
    if (error.status === 404)
      return 'Este espacio ya no está disponible. Conservamos lo que escribiste en esta pantalla.';
    if (error.status === 403)
      return 'No está permitido enviar a este espacio. Conservamos lo que escribiste en esta pantalla.';
    if (error.status === 400 || error.status === 422)
      return 'Revisá los datos del formulario. Tu texto permanece disponible para corregirlo.';
  }
  return 'No pudimos confirmar la recepción. Conservamos tu texto; verificá el estado antes de volver a enviarlo.';
}
const fieldClass =
  'min-h-12 w-full min-w-0 border bg-transparent px-3 py-3 font-body text-base text-foreground transition-none placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const labelClass = 'mb-3 block font-body text-sm font-medium';
const linkClass =
  'inline-flex min-h-11 items-center text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

function CaptureForm({ slug }: { slug: string }) {
  const [formState, setFormState] = useState<FormState>({ status: 'loading' }),
    [loadVersion, setLoadVersion] = useState(0);
  const [submitting, setSubmitting] = useState(false),
    [submissionResult, setSubmissionResult] =
      useState<PublicSubmissionResult | null>(null),
    [submitError, setSubmitError] = useState<string | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null),
    successRef = useRef<HTMLHeadingElement>(null),
    submissionVersion = useRef(0),
    submissionLock = useRef(false);
  const fileReader = useRef<FileReader | null>(null),
    fileVersion = useRef(0),
    readingRef = useRef(false),
    fileInput = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false),
    [imageError, setImageError] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null),
    [content, setContent] = useState(''),
    [authorName, setAuthorName] = useState(''),
    [videoUrl, setVideoUrl] = useState(''),
    [imageBase64, setImageBase64] = useState('');
  useEffect(() => {
    let active = true;
    setFormState({ status: 'loading' });
    void getFormInfo(slug)
      .then((info) => {
        if (active) setFormState({ status: 'ready', info });
      })
      .catch((error) => {
        if (active) setFormState({ status: 'error', error });
      });
    return () => {
      active = false;
    };
  }, [slug, loadVersion]);
  useEffect(
    () => () => {
      submissionVersion.current++;
      fileVersion.current++;
      if (fileReader.current?.readyState === FileReader.LOADING)
        fileReader.current.abort();
    },
    [],
  );
  useEffect(() => {
    if (submitError) feedbackRef.current?.focus();
  }, [submitError]);
  useEffect(() => {
    if (submissionResult) successRef.current?.focus();
  }, [submissionResult]);

  function clearImage() {
    fileVersion.current++;
    if (fileReader.current?.readyState === FileReader.LOADING)
      fileReader.current.abort();
    readingRef.current = false;
    setReading(false);
    setImageBase64('');
    setImageError(null);
    if (fileInput.current) fileInput.current.value = '';
  }
  function selectImage(file: File | undefined) {
    clearImage();
    if (!file) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      !file.size ||
      file.size > 10 * 1024 * 1024
    ) {
      setImageError(
        'Elegí una foto PNG, JPEG o WebP de hasta 10 MiB, o quitá la selección para enviar sin foto.',
      );
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    const version = ++fileVersion.current,
      reader = new FileReader();
    fileReader.current = reader;
    readingRef.current = true;
    setReading(true);
    reader.onload = () => {
      if (version !== fileVersion.current) return;
      readingRef.current = false;
      setReading(false);
      if (typeof reader.result === 'string') setImageBase64(reader.result);
      else
        setImageError(
          'No pudimos leer la foto. Elegí otra o quitá la selección.',
        );
    };
    reader.onerror = () => {
      if (version !== fileVersion.current) return;
      readingRef.current = false;
      setReading(false);
      setImageError(
        'No pudimos leer la foto. Elegí otra o quitá la selección.',
      );
    };
    reader.readAsDataURL(file);
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      submissionLock.current ||
      readingRef.current ||
      formState.status !== 'ready' ||
      !formState.info.isPublicFormEnabled
    )
      return;
    if (rating === null) {
      setSubmitError(
        'Elegí una calificación de 1 a 5 estrellas antes de enviar.',
      );
      return;
    }
    if (
      [...content.trim()].length < 10 ||
      content.trim().length > 1000 ||
      authorName.trim().length < 2 ||
      authorName.trim().length > 120
    ) {
      setSubmitError(
        'Escribí tu nombre (2 a 120 caracteres) y un testimonio de 10 a 1000 caracteres.',
      );
      return;
    }
    if (imageError) {
      setSubmitError(
        'Revisá la foto seleccionada o quitála para enviar sin foto.',
      );
      return;
    }
    if (videoUrl.trim() && !youtubeVideoId(videoUrl.trim())) {
      setSubmitError(
        'Usá un enlace HTTPS de YouTube: youtu.be/ID o youtube.com/watch?v=ID. Podés quitarlo para enviar sin video.',
      );
      return;
    }
    submissionLock.current = true;
    const version = ++submissionVersion.current;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitPublicTestimonial(slug, {
        rating,
        content: content.trim(),
        authorName: authorName.trim(),
        videoUrl: videoUrl.trim() || undefined,
        imageBase64: imageBase64 || undefined,
      });
      if (version === submissionVersion.current) setSubmissionResult(result);
    } catch (error) {
      if (version === submissionVersion.current)
        setSubmitError(submissionErrorCopy(error));
    } finally {
      if (version === submissionVersion.current) {
        submissionLock.current = false;
        setSubmitting(false);
      }
    }
  }
  if (formState.status === 'loading')
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <NoiseOverlay />
        <p role="status" className="font-body text-base">
          Cargando formulario…
        </p>
      </main>
    );
  if (formState.status === 'error') {
    const { title, detail, retry } = loadFailureCopy(
      formState.error,
      'el formulario',
    );
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <NoiseOverlay />
        <div className="relative max-w-md text-center">
          <h1 className="font-caption text-3xl italic">{title}</h1>
          <p className="mt-4 font-body text-base text-muted-foreground">
            {detail}
          </p>
          {retry !== false && (
            <Button
              type="button"
              variant="outline"
              className="mt-6"
              onClick={() => setLoadVersion((v) => v + 1)}
            >
              Reintentar
            </Button>
          )}
        </div>
      </main>
    );
  }
  const info = formState.info;
  if (!info.isPublicFormEnabled || submissionResult) {
    const failed = submissionResult?.failedMedia
      .map((media) => (media === 'image' ? 'la foto' : 'el video'))
      .join(' y ');
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <NoiseOverlay />
        <div className="relative max-w-lg text-center">
          <div className="mb-8 flex flex-col items-center gap-4">
            <TenantLogo name={info.name} logoUrl={info.logoUrl} />
            <p className="max-w-full break-words font-body text-base font-medium">
              {info.name}
            </p>
          </div>
          {submissionResult && (
            <CheckCircle
              aria-hidden="true"
              className="mx-auto mb-5 h-12 w-12 text-primary"
            />
          )}
          <h1
            ref={successRef}
            tabIndex={-1}
            className="font-caption text-4xl italic"
          >
            {submissionResult ? '¡Muchas gracias!' : 'Recepción cerrada'}
          </h1>
          <p className="mt-4 font-body text-base leading-relaxed text-muted-foreground">
            {submissionResult
              ? 'Recibimos tu testimonio. Quedó pendiente de revisión antes de publicarse.'
              : 'Este espacio no está recibiendo nuevos testimonios en este momento.'}
          </p>
          {submissionResult?.status === 'partial' && (
            <p role="status" className="mt-4 font-body text-base">
              No pudimos confirmar el adjunto de {failed}. El texto ya se
              guardó; no vuelvas a enviar el formulario.
            </p>
          )}
          <Link
            className={`${linkClass} mt-6 font-body text-base`}
            href={`/t/${slug}`}
          >
            Ver testimonios publicados
          </Link>
        </div>
      </main>
    );
  }
  return (
    <main className="relative min-h-screen bg-background">
      <NoiseOverlay />
      <div className="relative z-10 grid min-h-screen min-w-0 grid-cols-[minmax(0,1fr)] lg:grid-cols-[1fr_1.2fr]">
        <header className="min-w-0 border-b px-6 py-8 sm:p-12 lg:flex lg:items-center lg:border-b-0 lg:border-r lg:p-16">
          <div className="min-w-0 max-w-md">
            <TenantLogo
              name={info.name}
              logoUrl={info.logoUrl}
              className="mb-5 h-14 w-14 sm:h-20 sm:w-20"
            />
            <h1 className="break-words font-caption text-3xl italic leading-tight sm:text-5xl">
              {info.name}
            </h1>
            <p className="mt-6 font-body text-base leading-relaxed text-muted-foreground">
              Compartí tu experiencia. Se revisará antes de publicarse.
            </p>
            <Link
              className={`${linkClass} mt-4 font-body text-sm`}
              href={`/t/${slug}`}
            >
              Leer testimonios publicados
            </Link>
          </div>
        </header>
        <div className="flex min-w-0 items-center justify-center px-6 py-8 sm:p-12 lg:p-16">
          <form
            method="post"
            noValidate
            onSubmit={handleSubmit}
            className="w-full min-w-0 max-w-lg"
            aria-label="Compartir testimonio"
            aria-busy={submitting}
          >
            <h2 className="mb-3 font-caption text-3xl">
              Contanos tu experiencia
            </h2>
            <p className="mb-6 font-body text-sm text-muted-foreground">
              Calificación, testimonio y nombre son obligatorios. Los adjuntos
              son opcionales.
            </p>
            {submitError && (
              <div
                ref={feedbackRef}
                tabIndex={-1}
                role="alert"
                id="capture-error"
                className="mb-6 border border-destructive bg-card p-4 font-body text-base"
              >
                {submitError}
              </div>
            )}
            <fieldset
              className="mb-8 min-w-0"
              disabled={submitting}
              aria-invalid={submitError && rating === null ? true : undefined}
              aria-describedby={`rating-help${submitError && rating === null ? ' capture-error' : ''}`}
            >
              <legend className={labelClass}>Calificá tu experiencia</legend>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <label key={star} className="cursor-pointer">
                    <input
                      type="radio"
                      name="rating"
                      value={star}
                      checked={rating === star}
                      onChange={() => {
                        setRating(star);
                        setSubmitError(null);
                      }}
                      required
                      aria-label={`${star} ${star === 1 ? 'estrella' : 'estrellas'}`}
                      className="peer sr-only"
                    />
                    <span className="flex h-11 w-11 items-center justify-center peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                      <Star
                        aria-hidden="true"
                        className={cn(
                          'h-8 w-8',
                          rating !== null && rating >= star
                            ? 'fill-primary text-primary'
                            : 'text-muted-foreground',
                        )}
                      />
                    </span>
                  </label>
                ))}
              </div>
              <p
                id="rating-help"
                className="mt-3 font-body text-sm text-muted-foreground"
              >
                {rating === null
                  ? 'Elegí una calificación de 1 a 5 estrellas.'
                  : `Elegiste ${rating} de 5 estrellas.`}
              </p>
            </fieldset>
            <div className="mb-6">
              <label htmlFor="capture-content" className={labelClass}>
                Contanos tu historia
              </label>
              <p
                id="capture-content-help"
                className="mb-3 font-body text-sm text-muted-foreground"
              >
                De 10 a 1000 caracteres.
              </p>
              <textarea
                id="capture-content"
                name="content"
                required
                minLength={10}
                maxLength={1000}
                readOnly={submitting}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                aria-describedby={`capture-content-help${submitError ? ' capture-error' : ''}`}
                className={`${fieldClass} min-h-40 resize-y`}
              />
            </div>
            <div className="mb-6">
              <label htmlFor="capture-author" className={labelClass}>
                Tu Nombre Completo
              </label>
              <input
                id="capture-author"
                name="authorName"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                maxLength={120}
                readOnly={submitting}
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                aria-describedby={submitError ? 'capture-error' : undefined}
                className={fieldClass}
              />
            </div>
            <div className="mb-8 grid min-w-0 gap-6 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="capture-image" className={labelClass}>
                  Foto (opcional)
                </label>
                <p
                  id="capture-image-help"
                  className="mb-3 font-body text-sm text-muted-foreground"
                >
                  PNG, JPEG o WebP, hasta 10 MiB.
                </p>
                <input
                  ref={fileInput}
                  id="capture-image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={submitting || reading}
                  onChange={(e) => selectImage(e.target.files?.[0])}
                  aria-describedby={`capture-image-help${imageError ? ' capture-image-error' : ''}`}
                  className="block min-h-12 w-full min-w-0 max-w-full border bg-transparent p-2 font-body text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                />
                {reading && (
                  <p role="status" className="mt-2 font-body text-sm">
                    Leyendo foto…
                  </p>
                )}
                {imageError && (
                  <p
                    role="alert"
                    id="capture-image-error"
                    className="mt-2 font-body text-sm text-destructive"
                  >
                    {imageError}
                  </p>
                )}
                {(imageBase64 || imageError) && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    disabled={submitting || reading}
                    onClick={() => {
                      clearImage();
                      setSubmitError(null);
                      fileInput.current?.focus();
                    }}
                  >
                    Quitar foto
                  </Button>
                )}
              </div>
              <div className="min-w-0">
                <label htmlFor="capture-video" className={labelClass}>
                  Video de YouTube (opcional)
                </label>
                <p
                  id="capture-video-help"
                  className="mb-3 font-body text-sm text-muted-foreground"
                >
                  Enlace HTTPS de youtu.be o youtube.com/watch.
                </p>
                <input
                  id="capture-video"
                  type="url"
                  name="videoUrl"
                  inputMode="url"
                  value={videoUrl}
                  readOnly={submitting}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  aria-describedby="capture-video-help"
                  className={fieldClass}
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={submitting || reading}
              className="h-auto min-h-12 w-full whitespace-normal py-3 font-body text-base transition-none"
            >
              {submitting ? 'Enviando…' : 'Enviar testimonio'}
            </Button>
            {submitting && (
              <p role="status" className="mt-3 font-body text-sm">
                Esperando confirmación del envío…
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
export default function PublicCapturePage() {
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  return <CaptureForm key={slug} slug={slug} />;
}
