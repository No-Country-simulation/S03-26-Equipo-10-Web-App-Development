'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/hooks/use-session';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Star, Loader2, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateTestimonialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateTestimonialModal({
  open,
  onOpenChange,
  onCreated,
}: CreateTestimonialModalProps) {
  const { fetchApi } = useSession();

  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [rating, setRating] = useState(5);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Metadata
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [allTags, setAllTags] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    async function loadMeta() {
      if (!open) return;
      try {
        const [catRes, tagRes] = await Promise.all([
          fetchApi<{id: string, name: string}[]>('/categories'),
          fetchApi<{id: string, name: string}[]>('/tags')
        ]);
        setCategories(catRes.data);
        setAllTags(tagRes.data);
      } catch (e) { console.error('Error loading meta', e); }
    }
    void loadMeta();
  }, [open, fetchApi]);

  function resetForm() {
    setAuthorName('');
    setContent('');
    setRating(5);
    setCategoryId(null);
    setTagIds([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authorName.trim() || !content.trim()) return;

    setSubmitting(true);
    try {
      await fetchApi('/testimonials', {
        method: 'POST',
        body: JSON.stringify({ 
          authorName, 
          content, 
          rating,
          categoryId: categoryId || undefined,
          tagIds: tagIds.length > 0 ? tagIds : undefined
        }),
      });
      resetForm();
      onCreated();
      onOpenChange(false);
    } catch (err: any) {
      alert('Error creando testimonio: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) resetForm(); onOpenChange(val); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-0 bg-background rounded-none shadow-2xl">
        <DialogTitle className="sr-only">Crear nuevo testimonio</DialogTitle>
        <DialogDescription className="sr-only">Formulario para registrar un nuevo testimonio en el sistema</DialogDescription>

        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row max-h-[90vh]">

          {/* Left Column: Editorial Content Entry */}
          <div className="flex-1 bg-card p-8 md:p-12 border-b md:border-b-0 md:border-r relative overflow-y-auto">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary/40" />

            <header className="flex items-center gap-3 mb-10">
              <PenLine className="w-5 h-5 text-primary" />
              <span className="font-body text-[10px] font-bold uppercase tracking-widest text-primary">
                Nuevo Testimonio
              </span>
            </header>

            {/* Author */}
            <div className="mb-8">
              <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Autor del testimonio
              </Label>
              <input
                type="text"
                required
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Nombre completo del cliente"
                className="w-full mt-3 bg-transparent font-caption text-2xl italic leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none border-b-2 border-border focus:border-primary pb-2 transition-colors"
              />
            </div>

            {/* Content */}
            <div>
              <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Contenido del testimonio
              </Label>
              <textarea
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escribe aquí la experiencia del cliente con tu producto o servicio..."
                className="w-full mt-3 bg-transparent font-caption text-xl italic leading-relaxed text-foreground placeholder:text-muted-foreground/30 focus:outline-none border-b-2 border-border focus:border-primary resize-none min-h-[180px] transition-colors"
              />
            </div>
          </div>

          {/* Right Column: Rating & Actions */}
          <div className="w-full md:w-[280px] bg-background p-6 flex flex-col justify-between gap-8 overflow-y-auto">

            {/* Rating */}
            <div className="space-y-4">
              <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">
                Valoración del cliente
              </Label>
              <div className="flex justify-center gap-2 py-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-125 focus:outline-none"
                  >
                    <Star
                      className={cn(
                        'h-8 w-8 transition-colors',
                        rating >= star
                          ? 'fill-primary text-primary'
                          : 'text-muted-foreground/20 hover:text-muted-foreground/40',
                      )}
                    />
                  </button>
                ))}
              </div>
              <p className="text-center font-body text-xs text-muted-foreground">
                {rating === 5 && 'Excelente'}
                {rating === 4 && 'Muy bueno'}
                {rating === 3 && 'Bueno'}
                {rating === 2 && 'Regular'}
                {rating === 1 && 'Malo'}
              </p>
            </div>

            <div className="h-px bg-border" />

            {/* Categorization */}
            <div className="space-y-4">
              <div>
                <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
                  Categoría
                </Label>
                <select 
                  value={categoryId || ''} 
                  onChange={e => setCategoryId(e.target.value || null)}
                  className="w-full bg-background border-b border-border p-2 font-body text-xs focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="">Sin Categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
                  Etiquetas
                </Label>
                <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto p-2 border border-dashed">
                  {allTags.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        setTagIds(prev => 
                          prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                        );
                      }}
                      className={cn(
                        "font-body text-[8px] uppercase tracking-wider px-2 py-1 transition-colors",
                        tagIds.includes(tag.id) 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {tag.name}
                    </button>
                  ))}
                  {allTags.length === 0 && <p className="text-[8px] text-muted-foreground italic w-full text-center">No hay etiquetas</p>}
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Preview hint */}
            <div className="flex-1 p-4 border border-dashed text-center flex flex-col items-center justify-center gap-2">
              <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
                Vista previa
              </p>
              {content.trim() ? (
                <p className="font-caption text-sm italic text-foreground/60 line-clamp-3">
                  &ldquo;{content}&rdquo;
                </p>
              ) : (
                <p className="font-body text-xs text-muted-foreground/40">
                  El extracto aparecerá aquí...
                </p>
              )}
              {authorName.trim() && (
                <p className="font-body text-[10px] font-bold uppercase tracking-wider text-foreground/40 mt-2">
                  — {authorName}
                </p>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                disabled={submitting || !authorName.trim() || !content.trim()}
                className="w-full rounded-none font-body text-xs uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 py-5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Registrar Testimonio'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { resetForm(); onOpenChange(false); }}
                className="w-full rounded-none font-body text-[10px] uppercase tracking-wider text-muted-foreground"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
