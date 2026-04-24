'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service like Sentry or Pino
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[80vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h2 className="text-3xl tracking-tighter sm:text-5xl font-heading">
          Algo salió mal.
        </h2>
        <p className="text-muted-foreground font-body max-w-[500px] mx-auto text-lg">
          No pudimos procesar tu solicitud en este momento. Por favor, intenta de nuevo.
        </p>
      </div>
      <Button 
        onClick={() => reset()}
        variant="outline"
        className="border-primary rounded-none font-caption italic hover:bg-primary hover:text-primary-foreground transition-colors"
      >
        Intentar nuevamente
      </Button>
    </div>
  );
}
