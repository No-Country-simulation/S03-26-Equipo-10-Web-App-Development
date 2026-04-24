import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground font-caption italic tracking-widest uppercase">
        Cargando...
      </p>
    </div>
  );
}
