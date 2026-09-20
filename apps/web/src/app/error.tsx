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
    // OBS-F9: Logging estructurado con digest para correlación con logs del servidor.
    // En producción, reemplazar con un servicio de telemetría (Sentry, Datadog, etc.)
    console.error('Unhandled Client Error:', {
      message: error.message,
      digest: error.digest,
      // Ocultar stack en producción para prevenir fuga de detalles de implementación
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    });
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
        {/* OBS-F8: Mostrar error.digest como código de referencia para soporte técnico.
            Permite correlacionar el reporte del usuario con los logs del servidor. */}
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground/60 mt-2">
            Referencia:{' '}
            <span className="font-semibold text-muted-foreground">
              {error.digest}
            </span>
          </p>
        )}
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
