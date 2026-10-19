'use client';
import { useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ActionFeedback } from '@/features/shared/feedback';
import type { WebhookView } from '../api';
import { dateLabel, eventLabel } from '../presentation';
export type SecretReveal = {
  target: WebhookView;
  value: string;
  sequence: number;
};
export function SigningSecret({
  reveal,
  onHide,
  onHistory,
}: {
  reveal: SecretReveal;
  onHide: () => void;
  onHistory: () => void;
}) {
  const [copied, setCopied] = useState(false),
    [failed, setFailed] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  async function copy() {
    setCopied(false);
    try {
      await navigator.clipboard.writeText(reveal.value);
      setCopied(true);
      setFailed(false);
    } catch {
      setFailed(true);
      field.current?.focus();
      field.current?.select();
    }
  }
  return (
    <section
      aria-labelledby="signing-secret-title"
      className="mb-6 min-w-0 border border-primary bg-card p-4 font-body sm:p-6"
    >
      <h2 id="signing-secret-title" className="text-lg font-semibold">
        Secreto de firma
      </h2>
      <p className="mt-2 break-all text-sm font-medium">{reveal.target.url}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {eventLabel(reveal.target.eventCode)}
      </p>
      <p role="status" className="mt-3 text-sm">
        Secreto generado. Guardalo ahora: no volverá a mostrarse.
      </p>
      <Label htmlFor="webhook-signing-secret" className="mt-4 block">
        Secreto completo para copiar
      </Label>
      <textarea
        ref={field}
        id="webhook-signing-secret"
        readOnly
        spellCheck={false}
        autoComplete="off"
        rows={3}
        value={reveal.value}
        onFocus={(event) => event.currentTarget.select()}
        className="mt-2 w-full resize-none border bg-background p-3 font-mono text-sm break-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {failed && (
        <ActionFeedback>
          No se pudo copiar el secreto. Está seleccionado: usá el menú Copiar de
          tu dispositivo o Ctrl/Cmd+C.
        </ActionFeedback>
      )}
      {copied && (
        <p role="status" className="mt-3 text-sm">
          Secreto copiado al portapapeles.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => void copy()}>
          {copied ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {copied ? 'Secreto copiado' : 'Copiar secreto de firma'}
        </Button>
        <Button type="button" variant="ghost" onClick={onHide}>
          Ocultar secreto
        </Button>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Configurá tu receptor para verificar X-TMS-Signature con este secreto y
        deduplicar por ID de evento antes de producir efectos.
      </p>
      {reveal.target.signatureGraceUntil ? (
        <p className="mt-2 text-sm text-muted-foreground">
          El secreto anterior participa en la firma hasta el{' '}
          {dateLabel(reveal.target.signatureGraceUntil)}. La API rechaza otra
          rotación durante esa gracia. La entrega también depende de que el
          destino y su compatibilidad sigan habilitados.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No se informó una ventana de gracia para un secreto anterior.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={onHistory}
        className="mt-4"
      >
        Ver entregas de este destino
      </Button>
    </section>
  );
}
