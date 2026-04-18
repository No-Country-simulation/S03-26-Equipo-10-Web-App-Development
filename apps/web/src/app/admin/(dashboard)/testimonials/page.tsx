'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { TestimonialRecord } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { TestimonialModal } from '@/components/testimonials/TestimonialModal';
import { CreateTestimonialModal } from '@/components/testimonials/CreateTestimonialModal';

export default function TestimonialsPage() {
  const { session, fetchApi } = useSession();
  const [testimonials, setTestimonials] = useState<TestimonialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTestimonial, setSelectedTestimonial] = useState<TestimonialRecord | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Filter States
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchApi<TestimonialRecord[]>('/testimonials');
      setTestimonials(res.data);
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (session) void load(); }, [session]);

  // Compute dynamic filters
  const categoryCounts = new Map<string, { name: string; count: number }>();
  const tagCounts = new Map<string, { name: string; count: number }>();

  testimonials.forEach(t => {
    if (t.category) {
      const existing = categoryCounts.get(t.category.id);
      if (existing) existing.count++;
      else categoryCounts.set(t.category.id, { name: t.category.name, count: 1 });
    }
    if (t.tags) {
      t.tags.forEach(tag => {
        const existing = tagCounts.get(tag.id);
        if (existing) existing.count++;
        else tagCounts.set(tag.id, { name: tag.name, count: 1 });
      });
    }
  });

  const filtered = testimonials.filter(
    (t) => {
      const matchSearch = t.authorName.toLowerCase().includes(search.toLowerCase()) || t.content.toLowerCase().includes(search.toLowerCase());
      const matchCategory = selectedCategoryId ? t.categoryId === selectedCategoryId : true;
      const matchTags = selectedTagIds.length > 0 ? selectedTagIds.every(tagId => t.tags?.some(tag => tag.id === tagId)) : true;
      return matchSearch && matchCategory && matchTags;
    }
  );

  return (
    <>
      <DashboardHeader title="Testimonios" description="Gestiona y modera las opiniones de tus clientes.">
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-10 bg-primary px-6 font-body text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" /> Nuevo
        </Button>
        <Button
          variant="ghost"
          onClick={() => void load()}
          className="h-10 font-body text-xs uppercase tracking-wider"
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refrescar
        </Button>
      </DashboardHeader>

      {/* Search & Filters */}
      <div className="mb-8 space-y-4">
        {/* Text Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por autor o contenido..."
            className="h-10 bg-transparent pl-10 font-body text-sm rounded-none border-t-0 border-x-0 border-b-2 border-border focus-visible:ring-0 focus-visible:border-primary"
          />
        </div>

        {/* Dynamic Category Tabs */}
        {categoryCounts.size > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={cn(
                "font-body text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 transition-colors border",
                selectedCategoryId === null ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground hover:bg-muted/50 border-border"
              )}
            >
              Todas ({testimonials.length})
            </button>
            {Array.from(categoryCounts.entries()).map(([id, { name, count }]) => (
              <button
                key={id}
                onClick={() => setSelectedCategoryId(id)}
                className={cn(
                  "font-body text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 transition-colors border",
                  selectedCategoryId === id ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground hover:bg-muted/50 border-border"
                )}
              >
                {name} ({count})
              </button>
            ))}
          </div>
        )}

        {/* Dynamic Tag Chips */}
        {tagCounts.size > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Array.from(tagCounts.entries()).map(([id, { name, count }]) => (
              <button
                key={id}
                onClick={() => {
                  setSelectedTagIds(prev => 
                    prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
                  );
                }}
                className={cn(
                  "font-body text-[9px] uppercase tracking-wider px-2 py-1 transition-colors border rounded-full",
                  selectedTagIds.includes(id) 
                    ? "bg-foreground text-background border-foreground" 
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                )}
              >
                #{name} <span className="opacity-50">({count})</span>
              </button>
            ))}
            {selectedTagIds.length > 0 && (
              <button 
                onClick={() => setSelectedTagIds([])}
                className="font-body text-[9px] uppercase tracking-wider px-2 py-1 text-destructive hover:underline ml-2"
              >
                Limpiar Etiquetas
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-20">
          <div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent" />
          <span className="font-body text-sm text-muted-foreground">Cargando...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed p-12 text-center">
          <p className="font-body text-sm text-muted-foreground">No se encontraron testimonios.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-card shadow-soft-lg">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="py-4 pl-4 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ID</th>
                <th className="py-4 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Autor</th>
                <th className="py-4 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Extracto</th>
                <th className="py-4 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estado</th>
                <th className="py-4 text-right pr-4 font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr 
                  key={t.id} 
                  className="border-b border-border/50 transition-colors hover:bg-muted/10 group"
                >
                  <td className="py-4 pl-4 font-body text-xs text-muted-foreground">{t.id.split('-')[0]}</td>
                  <td className="py-4 pr-4 font-body text-sm font-medium text-foreground">{t.authorName}</td>
                  <td className="max-w-[200px] sm:max-w-xs py-4 pr-4">
                    <div className="truncate font-caption text-sm italic text-muted-foreground mb-1">
                      &ldquo;{t.content}&rdquo;
                    </div>
                    <div className="flex gap-1 overflow-hidden">
                      {t.category && <span className="text-[8px] bg-primary/10 text-primary px-1 font-body uppercase">{t.category.name}</span>}
                      {t.tags?.slice(0, 2).map(tag => (
                        <span key={tag.id} className="text-[8px] border px-1 font-body text-muted-foreground uppercase">#{tag.name}</span>
                      ))}
                      {(t.tags?.length || 0) > 2 && <span className="text-[8px] text-muted-foreground">...</span>}
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <span className={cn(
                      'inline-block px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider',
                      t.status === 'published' && 'bg-primary/20 text-primary',
                      t.status === 'pending' && 'bg-accent/20 text-accent',
                      t.status === 'draft' && 'bg-muted text-muted-foreground',
                      t.status === 'approved' && 'bg-primary/10 text-primary',
                      t.status === 'rejected' && 'bg-destructive/20 text-destructive',
                    )}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-4 pr-4 text-right">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setSelectedTestimonial(t);
                        setSheetOpen(true);
                      }}
                      className="font-body text-[10px] uppercase tracking-wider hover:bg-primary hover:text-primary-foreground rounded-none"
                    >
                      Abrir Testimonio
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateTestimonialModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void load()}
      />

      <TestimonialModal 
        testimonial={selectedTestimonial}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setTimeout(() => setSelectedTestimonial(null), 300);
        }}
        onUpdated={() => void load()}
      />
    </>
  );
}
