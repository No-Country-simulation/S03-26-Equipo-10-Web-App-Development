import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LoadingState({
  children = 'Cargando…',
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-atomic="true"
      className={cn(
        'flex items-center gap-3 py-8 font-body text-sm text-muted-foreground',
        className,
      )}
    >
      <Loader2
        aria-hidden="true"
        className="h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none"
      />
      <span>{children}</span>
    </div>
  );
}
export function ActionFeedback({
  kind = 'error',
  children,
  className,
}: {
  kind?: 'error' | 'success' | 'info' | 'warning';
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
      className={cn(
        'mb-6 border bg-card p-4 font-body text-sm text-foreground',
        kind === 'error' && 'border-destructive',
        kind === 'success' && 'border-success',
        kind === 'warning' && 'border-warning',
        kind === 'info' && 'border-info',
        className,
      )}
    >
      {children}
    </div>
  );
}
