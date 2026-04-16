'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShieldAlert, Star, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { API_URL } from '@/constants';

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
        body: JSON.stringify({ rating, content, authorName }),
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F2EA]">
        <div className="h-6 w-6 animate-spin border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !formInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F2EA] p-4">
        <div className="text-center max-w-sm">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-destructive/40" />
          <h1 className="font-caption text-xl uppercase tracking-widest text-[#0A0A0A]">Empresa no encontrada</h1>
          <p className="mt-2 font-body text-sm text-foreground/70">Asegúrate de haber ingresado correctamente al enlace proporcionado por la empresa.</p>
        </div>
      </div>
    );
  }

  if (!formInfo.isPublicFormEnabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F2EA] p-4">
        <div className="text-center max-w-sm">
          <h1 className="font-caption text-xl uppercase tracking-widest text-[#0A0A0A]">Recepción Cerrada</h1>
          <p className="mt-4 font-body text-sm text-foreground/70">
            En este momento, <span className="font-italic font-bold">{formInfo.name}</span> no se encuentra recibiendo testimonios mediante este formulario.
          </p>
          <p className="mt-2 font-body text-xs text-muted-foreground uppercase tracking-widest">Muchas gracias.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F2EA] p-4">
        <div className="text-center max-w-sm bg-white p-8 border shadow-sm">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h1 className="font-caption text-2xl mb-2 text-[#0A0A0A]">¡Muchas Gracias!</h1>
          <p className="font-body text-sm text-foreground/70">
            Tu opinión es muy valiosa para <span className="font-italic font-bold text-primary">{formInfo.name}</span>. Hemos recibido tu testimonio exitosamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F2EA] p-4">
      <div className="w-full max-w-xl bg-white p-8 sm:p-12 border shadow-sm">
        <div className="text-center mb-8">
          <p className="font-body text-xs uppercase tracking-widest text-muted-foreground mb-2">Comentarios para</p>
          <h1 className="font-caption text-3xl italic text-primary">{formInfo.name}</h1>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6">
          <div>
            <label className="font-body text-[10px] uppercase font-bold tracking-widest block text-muted-foreground mb-3 text-center">Califica tu experiencia</label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={cn('h-8 w-8', rating >= star ? 'fill-primary text-primary' : 'text-muted-foreground/30')}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-body text-[10px] uppercase font-bold tracking-widest block text-muted-foreground mb-2">Cuéntanos tu historia</label>
            <textarea
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="¿Qué es lo que más te gustó? ¿A quién se lo recomendarías?"
              className="w-full border p-4 bg-[#F5F2EA]/20 font-body text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[160px] resize-none"
            />
          </div>

          <div>
            <label className="font-body text-[10px] uppercase font-bold tracking-widest block text-muted-foreground mb-2">Tu Nombre Completo</label>
            <input
              type="text"
              required
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Ej. Juan Pérez"
              className="w-full border p-4 bg-[#F5F2EA]/20 font-body text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-full py-6 mt-4 font-body text-sm uppercase tracking-widest bg-[#0A0A0A] hover:bg-primary transition-colors text-white">
            {submitting ? 'Enviando...' : 'Enviar Testimonio'}
          </Button>
          <p className="text-center font-body text-[10px] text-muted-foreground mt-4 uppercase tracking-widest">
            Tus datos serán revisados amablemente.
          </p>
        </form>
      </div>
    </div>
  );
}
