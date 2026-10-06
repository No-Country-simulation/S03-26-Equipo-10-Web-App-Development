'use client';

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ShieldAlert, Star, CheckCircle, MessageSquareQuote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NoiseOverlay } from '@/components/ui/NoiseOverlay';
import { ApiError } from '@/lib/api';
import { loadFailureCopy } from '@/features/shared/load-failure';
import { getFormInfo, submitPublicTestimonial } from '../api';

interface FormInfo {
  name: string;
  isPublicFormEnabled: boolean;
}

type FormState =
  | { status: 'loading'; slug: string }
  | { status: 'error'; slug: string; error: unknown }
  | { status: 'ready'; slug: string; info: FormInfo };

function submissionErrorCopy(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'PUBLIC_SUBMISSION_RECENT_BROWSER') {
      return 'Este navegador tiene una marca de envío reciente. Este intento no se guardó; intentá más adelante.';
    }
    if (error.status === 429) return 'Alcanzaste el límite de envíos. Esperá antes de volver a intentar; este intento no se guardó.';
    if (error.status === 404) return 'Este espacio ya no está disponible. Conservamos lo que escribiste en esta pantalla.';
    if (error.status === 403) return 'No está permitido enviar a este espacio. Conservamos lo que escribiste en esta pantalla.';
    if (error.status === 400 || error.status === 422) return 'Revisá los datos del formulario. Tu texto permanece disponible para corregirlo.';
  }
  return 'No pudimos confirmar la recepción. Conservamos tu texto; verificá el estado antes de volver a enviarlo.';
}

export default function PublicCapturePage() {
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug : '';

  const [formState, setFormState] = useState<FormState>({ status: 'loading', slug });
  const [loadVersion, setLoadVersion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const submissionVersion = useRef(0);
  const fileReader = useRef<FileReader | null>(null);
  const currentFormState: FormState = formState.slug === slug ? formState : { status: 'loading', slug };

  // Form State
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');

  useEffect(() => {
    let active = true;
    setFormState({ status: 'loading', slug });
    void getFormInfo(slug).then(info => {
      if (active) setFormState({ status: 'ready', slug, info });
    }).catch(error => {
      if (active) setFormState({ status: 'error', slug, error });
    });
    return () => { active = false; };
  }, [slug, loadVersion]);

  useEffect(() => () => {
    submissionVersion.current += 1;
    if (fileReader.current?.readyState === FileReader.LOADING) fileReader.current.abort();
  }, [slug]);

  useEffect(() => {
    setSuccess(false);
    setSubmitError(null);
    setSubmitting(false);
    setContent('');
    setAuthorName('');
    setVideoUrl('');
    setImageBase64('');
    setRating(5);
  }, [slug]);

  useEffect(() => { if (submitError) feedbackRef.current?.focus(); }, [submitError]);
  useEffect(() => { if (success) successRef.current?.focus(); }, [success]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting || currentFormState.status !== 'ready') return;
    if (content.trim().length < 10 || authorName.trim().length < 2) {
      setSubmitError('Escribí tu nombre y un testimonio de al menos 10 caracteres.');
      return;
    }

    const requestVersion = ++submissionVersion.current;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await submitPublicTestimonial(slug, {
        rating,
        content: content.trim(),
        authorName: authorName.trim(),
        videoUrl: videoUrl.trim() || undefined,
        imageBase64: imageBase64 || undefined,
      });
      if (requestVersion === submissionVersion.current) setSuccess(true);
    } catch (err) {
      if (requestVersion === submissionVersion.current) setSubmitError(submissionErrorCopy(err));
    } finally {
      if (requestVersion === submissionVersion.current) setSubmitting(false);
    }
  };

  /* ───── Loading ───── */
  if (currentFormState.status === 'loading') {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-background">
        <NoiseOverlay />
        <div role="status" className="font-body text-sm text-muted-foreground">Cargando formulario...</div>
      </main>
    );
  }

  /* ───── Error / Not Found ───── */
  if (currentFormState.status === 'error') {
    const { title, detail, retry } = loadFailureCopy(currentFormState.error, 'el formulario');
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-background p-4">
        <NoiseOverlay />
        <div className="text-center max-w-md animate-fade-in-up">
          <ShieldAlert className="mx-auto mb-6 h-12 w-12 text-destructive/40" />
          <h1 className="font-caption text-3xl italic text-foreground">{title}</h1>
          <p className="mt-4 font-body text-sm leading-relaxed text-muted-foreground">
            {detail}
          </p>
          {retry !== false && (
            <Button type="button" variant="outline" className="mt-6" onClick={() => setLoadVersion(version => version + 1)}>Reintentar</Button>
          )}
        </div>
      </main>
    );
  }

  const formInfo = currentFormState.info;

  /* ───── Form Disabled ───── */
  if (!formInfo.isPublicFormEnabled) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-background p-4">
        <NoiseOverlay />
        <div className="text-center max-w-md animate-fade-in-up">
          <MessageSquareQuote className="mx-auto mb-6 h-12 w-12 text-muted-foreground/30" />
          <h1 className="font-caption text-3xl italic text-foreground">Recepción Cerrada</h1>
          <p className="mt-4 font-body text-sm leading-relaxed text-muted-foreground">
            En este momento, <span className="font-bold text-foreground">{formInfo.name}</span> no se encuentra recibiendo testimonios mediante este formulario.
          </p>
          <p className="mt-6 font-body text-[10px] text-muted-foreground uppercase tracking-widest">Muchas gracias por tu interés.</p>
        </div>
      </main>
    );
  }

  /* ───── Success ───── */
  if (success) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-background p-4">
        <NoiseOverlay />
        <div className="text-center max-w-md animate-fade-in-up">
          <CheckCircle className="mx-auto mb-6 h-16 w-16 text-primary" />
          <h1 ref={successRef} tabIndex={-1} className="font-caption text-4xl italic text-foreground mb-4">¡Muchas gracias!</h1>
          <p className="font-body text-sm leading-relaxed text-muted-foreground">
            Tu opinión es muy valiosa para <span className="font-bold text-primary">{formInfo.name}</span>. 
            Hemos recibido tu testimonio exitosamente y será revisado en breve.
          </p>
          <div className="mt-8 h-px w-16 bg-primary mx-auto" />
        </div>
      </main>
    );
  }

  /* ───── Main Form ───── */
  return (
    <main className="relative min-h-screen bg-background">
      <NoiseOverlay />

      <div className="relative z-10 grid min-h-screen grid-cols-[minmax(0,1fr)] lg:grid-cols-[1fr,1.2fr]">
        
        {/* Left Column: Brand & Context */}
        <div className="flex flex-col justify-center border-b lg:border-b-0 lg:border-r p-8 sm:p-12 lg:p-16 xl:p-24">
          <div className="max-w-md animate-fade-in-up">
            <div className="flex items-center gap-3 mb-8">
              <span className="h-px w-10 bg-primary" />
              <span className="font-body text-[10px] font-bold uppercase tracking-widest text-primary">
                Testimonial CMS
              </span>
            </div>
            
            <p className="font-body text-xs uppercase tracking-widest text-muted-foreground mb-4">
              Buzón de opiniones para
            </p>
            <h1 className="font-caption text-5xl md:text-6xl italic leading-[1.1] text-foreground mb-8">
              {formInfo.name}
            </h1>
            
            <p className="font-body text-sm leading-relaxed text-muted-foreground max-w-sm">
              Tu experiencia importa. Compartí tu opinión honesta y ayudá a otros a descubrir
              lo que hace especial a esta marca. El testimonio será revisado antes de publicarse.
            </p>

            <div className="mt-12 hidden lg:block">
              <div className="flex items-center gap-3">
                <MessageSquareQuote className="h-5 w-5 text-primary/40" />
                <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
                  Powered by Testimonial CMS
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Form */}
        <div className="flex items-center justify-center p-8 sm:p-12 lg:p-16">
          <form onSubmit={handleSubmit} className="w-full max-w-lg animate-fade-in-up stagger-2">
            {submitError && (
              <div ref={feedbackRef} tabIndex={-1} role="alert" className="mb-8 border border-destructive bg-card p-4 font-body text-sm text-foreground">
                {submitError}
              </div>
            )}
            
            {/* Rating */}
            <fieldset className="mb-10">
              <legend className="font-body text-xs uppercase font-bold tracking-widest text-muted-foreground mb-4">
                Calificá tu experiencia
              </legend>
              <div className="flex gap-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <label key={star} className="cursor-pointer">
                    <input
                      type="radio"
                      name="rating"
                      value={star}
                      checked={rating === star}
                      onChange={() => setRating(star)}
                      aria-label={`${star} ${star === 1 ? 'estrella' : 'estrellas'}`}
                      className="peer sr-only"
                    />
                    <span className="flex h-11 w-11 items-center justify-center transition-transform hover:scale-110 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring motion-reduce:transform-none">
                      <Star aria-hidden="true" className={cn(
                        'h-9 w-9 transition-colors',
                        rating >= star ? 'fill-primary text-primary' : 'text-muted-foreground/60'
                      )} />
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Content */}
            <div className="mb-8">
              <label htmlFor="capture-content" className="font-body text-xs uppercase font-bold tracking-widest block text-muted-foreground mb-3">
                Contanos tu historia
              </label>
              <textarea
                id="capture-content"
                required
                minLength={10}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="¿Qué es lo que más te gustó? ¿A quién se lo recomendarías?"
                className="w-full border-b-2 border-border bg-transparent p-4 font-caption text-lg italic leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus:border-primary min-h-[160px] resize-y transition-colors"
              />
            </div>

            {/* Author */}
            <div className="mb-8">
              <label htmlFor="capture-author" className="font-body text-xs uppercase font-bold tracking-widest block text-muted-foreground mb-3">
                Tu Nombre Completo
              </label>
              <input
                id="capture-author"
                type="text"
                required
                minLength={2}
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Ej. Juan Pérez"
                className="w-full border-b-2 border-border bg-transparent p-4 font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus:border-primary transition-colors"
              />
            </div>

            {/* Optional: Image & Video */}
            <div className="grid sm:grid-cols-2 gap-6 mb-10">
              <div>
                <label htmlFor="capture-image" className="font-body text-xs uppercase font-bold tracking-widest block text-muted-foreground mb-3">
                  Foto <span className="text-muted-foreground">(opcional)</span>
                </label>
                <input
                  id="capture-image"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (fileReader.current?.readyState === FileReader.LOADING) fileReader.current.abort();
                    setImageBase64('');
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024) {
                      setImageBase64('');
                      setSubmitError('La foto supera el máximo de 10 MB. Elegí una imagen más pequeña.');
                      e.target.value = '';
                      return;
                    }
                    const reader = new FileReader();
                    fileReader.current = reader;
                    reader.onload = () => {
                      if (typeof reader.result === 'string') setImageBase64(reader.result);
                    };
                    reader.onerror = () => setSubmitError('No pudimos leer la foto. Elegí otra imagen.');
                    reader.readAsDataURL(file);
                  }}
                  className="w-full border border-dashed p-3 bg-transparent font-body text-xs text-muted-foreground cursor-pointer file:mr-3 file:py-1 file:px-3 file:border-0 file:text-[10px] file:font-bold file:uppercase file:tracking-wider file:bg-primary/10 file:text-primary hover:file:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-colors"
                />
              </div>

              <div>
                <label htmlFor="capture-video" className="font-body text-xs uppercase font-bold tracking-widest block text-muted-foreground mb-3">
                  Video de YouTube <span className="text-muted-foreground">(opcional)</span>
                </label>
                <input
                  id="capture-video"
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtu.be/..."
                  className="w-full border-b-2 border-border bg-transparent p-3 font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full py-6 font-body text-sm uppercase tracking-widest bg-foreground hover:bg-primary transition-colors text-background rounded-none"
            >
              {submitting ? 'Enviando...' : 'Enviar testimonio'}
            </Button>
            {submitting && <p role="status" className="mt-3 text-center font-body text-sm text-muted-foreground">Esperando confirmación del envío...</p>}
            <p className="text-center font-body text-[10px] text-muted-foreground mt-6 uppercase tracking-widest">
              Tus datos serán revisados con cuidado y respeto.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
