'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShieldAlert, Star, CheckCircle, MessageSquareQuote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NoiseOverlay } from '@/components/ui/NoiseOverlay';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface FormInfo {
  name: string;
  isPublicFormEnabled: boolean;
}

export default function PublicCapturePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [formInfo, setFormInfo] = useState<FormInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form State
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');

  useEffect(() => {
    async function loadInfo() {
      try {
        const res = await fetch(`${API_URL}/public/testimonials/${slug}/form-info`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        setFormInfo(data.data);
      } catch (e) {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    void loadInfo();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !authorName.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/public/testimonials/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          rating, 
          content, 
          authorName,
          videoUrl: videoUrl.trim() || undefined,
          imageBase64: imageBase64 || undefined
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error guardando testimonio');
      }

      setSuccess(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ───── Loading ───── */
  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background">
        <NoiseOverlay />
        <div className="h-6 w-6 animate-spin border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  /* ───── Error / Not Found ───── */
  if (error || !formInfo) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
        <NoiseOverlay />
        <div className="text-center max-w-md animate-fade-in-up">
          <ShieldAlert className="mx-auto mb-6 h-12 w-12 text-destructive/40" />
          <h1 className="font-caption text-3xl italic text-foreground">Espacio no encontrado</h1>
          <p className="mt-4 font-body text-sm leading-relaxed text-muted-foreground">
            Asegúrate de haber ingresado correctamente al enlace proporcionado por la empresa.
          </p>
        </div>
      </div>
    );
  }

  /* ───── Form Disabled ───── */
  if (!formInfo.isPublicFormEnabled) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
        <NoiseOverlay />
        <div className="text-center max-w-md animate-fade-in-up">
          <MessageSquareQuote className="mx-auto mb-6 h-12 w-12 text-muted-foreground/30" />
          <h1 className="font-caption text-3xl italic text-foreground">Recepción Cerrada</h1>
          <p className="mt-4 font-body text-sm leading-relaxed text-muted-foreground">
            En este momento, <span className="font-bold text-foreground">{formInfo.name}</span> no se encuentra recibiendo testimonios mediante este formulario.
          </p>
          <p className="mt-6 font-body text-[10px] text-muted-foreground uppercase tracking-widest">Muchas gracias por tu interés.</p>
        </div>
      </div>
    );
  }

  /* ───── Success ───── */
  if (success) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
        <NoiseOverlay />
        <div className="text-center max-w-md animate-fade-in-up">
          <CheckCircle className="mx-auto mb-6 h-16 w-16 text-primary" />
          <h1 className="font-caption text-4xl italic text-foreground mb-4">¡Muchas Gracias!</h1>
          <p className="font-body text-sm leading-relaxed text-muted-foreground">
            Tu opinión es muy valiosa para <span className="font-bold text-primary">{formInfo.name}</span>. 
            Hemos recibido tu testimonio exitosamente y será revisado en breve.
          </p>
          <div className="mt-8 h-px w-16 bg-primary mx-auto" />
        </div>
      </div>
    );
  }

  /* ───── Main Form ───── */
  return (
    <div className="relative min-h-screen bg-background">
      <NoiseOverlay />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1fr,1.2fr]">
        
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
              Tu experiencia importa. Comparte tu opinión honesta y ayuda a otros a descubrir 
              lo que hace especial a esta marca. Es confidencial y será revisada con respeto.
            </p>

            <div className="mt-12 hidden lg:block">
              <div className="flex items-center gap-3">
                <MessageSquareQuote className="h-5 w-5 text-primary/40" />
                <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground/60">
                  Powered by Testimonial CMS
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Form */}
        <div className="flex items-center justify-center p-8 sm:p-12 lg:p-16">
          <form onSubmit={handleSubmit} className="w-full max-w-lg animate-fade-in-up stagger-2">
            
            {/* Rating */}
            <div className="mb-10">
              <label className="font-body text-[10px] uppercase font-bold tracking-widest block text-muted-foreground mb-4">
                Califica tu experiencia
              </label>
              <div className="flex gap-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className={cn(
                        'h-10 w-10 transition-colors',
                        rating >= star ? 'fill-primary text-primary' : 'text-muted-foreground/20 hover:text-muted-foreground/40'
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="mb-8">
              <label className="font-body text-[10px] uppercase font-bold tracking-widest block text-muted-foreground mb-3">
                Cuéntanos tu historia
              </label>
              <textarea
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="¿Qué es lo que más te gustó? ¿A quién se lo recomendarías?"
                className="w-full border-b-2 border-border bg-transparent p-4 font-caption text-lg italic leading-relaxed text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary min-h-[160px] resize-none transition-colors"
              />
            </div>

            {/* Author */}
            <div className="mb-8">
              <label className="font-body text-[10px] uppercase font-bold tracking-widest block text-muted-foreground mb-3">
                Tu Nombre Completo
              </label>
              <input
                type="text"
                required
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Ej. Juan Pérez"
                className="w-full border-b-2 border-border bg-transparent p-4 font-body text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Optional: Image & Video */}
            <div className="grid sm:grid-cols-2 gap-6 mb-10">
              <div>
                <label className="font-body text-[10px] uppercase font-bold tracking-widest block text-muted-foreground mb-3">
                  Foto <span className="text-muted-foreground/40">(Opcional)</span>
                </label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return setImageBase64('');
                    const reader = new FileReader();
                    reader.onloadend = () => setImageBase64(reader.result as string);
                    reader.readAsDataURL(file);
                  }}
                  className="w-full border border-dashed p-3 bg-transparent font-body text-xs text-muted-foreground cursor-pointer file:mr-3 file:py-1 file:px-3 file:border-0 file:text-[10px] file:font-bold file:uppercase file:tracking-wider file:bg-primary/10 file:text-primary hover:file:bg-primary/20 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="font-body text-[10px] uppercase font-bold tracking-widest block text-muted-foreground mb-3">
                  Video de YouTube <span className="text-muted-foreground/40">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtu.be/..."
                  className="w-full border-b-2 border-border bg-transparent p-3 font-body text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full py-6 font-body text-sm uppercase tracking-widest bg-foreground hover:bg-primary transition-colors text-background rounded-none"
            >
              {submitting ? 'Enviando...' : 'Enviar Testimonio'}
            </Button>
            <p className="text-center font-body text-[10px] text-muted-foreground mt-6 uppercase tracking-widest">
              Tus datos serán revisados con cuidado y respeto.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
