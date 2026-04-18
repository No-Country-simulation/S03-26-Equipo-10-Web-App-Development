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

  const filtered = testimonials.filter(
    (t) =>
      t.authorName.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase()),
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

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por autor o contenido..."
          className="h-10 bg-transparent pl-10 font-body text-sm rounded-none border-t-0 border-x-0 border-b-2 border-border focus-visible:ring-0 focus-visible:border-primary"
        />
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
                  <td className="max-w-[200px] sm:max-w-xs truncate py-4 pr-4 font-caption text-sm italic text-muted-foreground">
                    &ldquo;{t.content}&rdquo;
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
