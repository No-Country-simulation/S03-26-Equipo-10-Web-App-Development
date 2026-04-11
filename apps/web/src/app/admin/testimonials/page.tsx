'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { TestimonialRecord } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Plus, RefreshCw, Search } from 'lucide-react';

export default function TestimonialsPage() {
  const { session, fetchApi } = useSession();
  const [testimonials, setTestimonials] = useState<TestimonialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

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

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetchApi('/testimonials', {
      method: 'POST',
      body: JSON.stringify({
        authorName: fd.get('authorName'),
        content: fd.get('content'),
        rating: Number(fd.get('rating')),
      }),
    });
    setShowForm(false);
    void load();
  }

  const filtered = testimonials.filter(
    (t) =>
      t.authorName.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <DashboardHeader title="Testimonios" description="Gestión y moderación de testimonios del tenant.">
        <Button
          onClick={() => setShowForm(!showForm)}
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

      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 grid gap-4 border bg-card p-6 sm:grid-cols-4">
          <div className="grid gap-2">
            <Label className="font-body text-[10px] font-bold uppercase tracking-widest">Autor</Label>
            <Input name="authorName" required className="h-10 bg-transparent" placeholder="Nombre del autor" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label className="font-body text-[10px] font-bold uppercase tracking-widest">Contenido</Label>
            <Input name="content" required className="h-10 bg-transparent" placeholder="Contenido del testimonio" />
          </div>
          <div className="grid gap-2">
            <Label className="font-body text-[10px] font-bold uppercase tracking-widest">Rating (1-5)</Label>
            <div className="flex gap-2">
              <Input name="rating" type="number" min={1} max={5} defaultValue={5} required className="h-10 w-20 bg-transparent" />
              <Button type="submit" className="h-10 flex-1 bg-primary font-body text-xs uppercase tracking-wider text-primary-foreground">
                Crear
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por autor o contenido..."
          className="h-10 bg-transparent pl-10 font-body text-sm"
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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Autor</th>
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contenido</th>
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rating</th>
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estado</th>
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Score</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-foreground/5 transition-colors hover:bg-card">
                  <td className="py-4 pr-4 font-body text-sm font-medium text-foreground">{t.authorName}</td>
                  <td className="max-w-xs truncate py-4 pr-4 font-caption text-sm italic text-muted-foreground">{t.content}</td>
                  <td className="py-4 pr-4">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg key={i} className={cn('h-3 w-3', i < t.rating ? 'text-primary' : 'text-muted-foreground/20')} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
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
                  <td className="py-4 font-body text-sm text-muted-foreground">{t.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
