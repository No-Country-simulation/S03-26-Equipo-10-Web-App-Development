'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { RefreshCw, Eye, MousePointerClick, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AnalyticsSummary {
  totalViews: number;
  totalClicks: number;
  totalPlays: number;
  events: Array<{
    id: number;
    testimonialId: string;
    eventType: string;
    createdAt: string;
  }>;
}

export default function AnalyticsPage() {
  const { session, fetchApi } = useSession();
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchApi<AnalyticsSummary>('/analytics/dashboard');
      setData(res.data);
    } catch {
      // If the dashboard endpoint doesn't exist yet, show empty state
      setData({ totalViews: 0, totalClicks: 0, totalPlays: 0, events: [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (session) void load(); }, [session]);

  const metrics = [
    { label: 'Visualizaciones', value: data?.totalViews ?? 0, icon: Eye },
    { label: 'Clics', value: data?.totalClicks ?? 0, icon: MousePointerClick },
    { label: 'Reproducciones', value: data?.totalPlays ?? 0, icon: Play },
  ];

  return (
    <>
      <DashboardHeader title="Analítica" description="Métricas de interacción con tus testimonios.">
        <Button variant="ghost" onClick={() => void load()} className="h-10 font-body text-xs uppercase tracking-wider">
          <RefreshCw className="mr-2 h-4 w-4" /> Refrescar
        </Button>
      </DashboardHeader>

      {loading ? (
        <div className="flex items-center gap-3 py-20"><div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {metrics.map((m) => (
              <div key={m.label} className="border p-8 transition-colors hover:bg-card">
                <div className="flex items-center justify-between">
                  <span className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{m.label}</span>
                  <m.icon className="h-5 w-5 text-primary/50" />
                </div>
                <p className="mt-4 font-caption text-5xl font-light italic text-foreground">{m.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <h2 className="mb-6 font-body text-xs font-bold uppercase tracking-widest text-foreground">Eventos Recientes</h2>
            {(!data?.events || data.events.length === 0) ? (
              <div className="border border-dashed p-12 text-center">
                <p className="font-body text-sm text-muted-foreground">No hay eventos de analítica registrados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tipo</th>
                      <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Testimonio ID</th>
                      <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.slice(0, 20).map((ev) => (
                      <tr key={ev.id} className="border-b border-foreground/5 transition-colors hover:bg-card">
                        <td className="py-3 pr-4">
                          <span className={cn('px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider',
                            ev.eventType === 'view' && 'bg-primary/10 text-primary',
                            ev.eventType === 'click' && 'bg-accent/20 text-accent',
                            ev.eventType === 'play' && 'bg-muted text-muted-foreground',
                          )}>{ev.eventType}</span>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{ev.testimonialId.slice(0, 8)}...</td>
                        <td className="py-3 font-body text-xs text-muted-foreground">{new Date(ev.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
