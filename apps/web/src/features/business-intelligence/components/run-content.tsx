import { duration, number, originNames, phaseName, statusNames, timestamp } from '../format';
import type { BiRun } from '../operations-schemas';
import { DetailLink } from './shared';

export function RunContent({ run }: { run: BiRun }) {
  const fields = [['Horario solicitado', timestamp(run.slotAt)], ['Corte observado', timestamp(run.sourceSnapshotAt)],
    ['Origen', originNames[run.origin]], ['Intento de la hora', `${run.attemptNo} de 3`], ['Resultado', statusNames[run.status]],
    ['Fase', phaseName(run.phase)], ['Inicio', timestamp(run.startedAt)], ['Fin', timestamp(run.finishedAt)], ['Duración', duration(run.durationMs)]];
  return <>
    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{fields.map(([label, value]) => <div key={label} className="min-w-0 border p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 break-words text-sm font-medium">{value}</dd>
    </div>)}</dl>
    {run.errorMessage && <p className="my-4 border border-destructive/50 p-4 text-sm">{run.errorMessage} {run.errorCode && <span className="break-all text-muted-foreground">({run.errorCode})</span>}</p>}
    <div className="my-6 grid gap-6 sm:grid-cols-2">
      <section className="border p-4"><h3 className="font-semibold">Filas extraídas</h3>{run.sourceCounts ? <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4"><dt>Categorías</dt><dd>{number(run.sourceCounts.categories)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Testimonios</dt><dd>{number(run.sourceCounts.testimonials)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Interacciones</dt><dd>{number(run.sourceCounts.events)}</dd></div>
      </dl> : <p className="mt-3 text-sm text-muted-foreground">Desconocidas: la extracción todavía no consta como completa.</p>}</section>
      <section className="border p-4"><h3 className="font-semibold">Filas publicadas</h3>{run.destinationCounts ? <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4"><dt>Testimonios</dt><dd>{number(run.destinationCounts.testimonials)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Interacciones agregadas</dt><dd>{number(run.destinationCounts.engagement)}</dd></div>
      </dl> : <p className="mt-3 text-sm text-muted-foreground">Sin publicación confirmada para este intento.</p>}</section>
    </div>
  </>;
}
export function RunTable({ runs, href, caption = 'Intentos de carga' }: { runs: BiRun[]; href: (id: string) => string; caption?: string }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{caption}</caption>
    <thead><tr>{['Inicio UTC', 'Horario solicitado UTC', 'Origen', 'Intento', 'Estado', 'Fase', 'Duración', 'Detalle'].map(label => <th scope="col" className="whitespace-nowrap border-b p-3" key={label}>{label}</th>)}</tr></thead>
    <tbody>{runs.length === 0 && <tr><td colSpan={8} className="border-b p-5">No hay intentos registrados con los filtros elegidos.</td></tr>}{runs.map(run => <tr key={run.id}>
      <th scope="row" className="whitespace-nowrap border-b p-3 font-normal">{timestamp(run.startedAt)}</th>
      <td className="whitespace-nowrap border-b p-3">{timestamp(run.slotAt)}</td><td className="border-b p-3">{originNames[run.origin]}</td>
      <td className="border-b p-3">{run.attemptNo}/3</td><td className="border-b p-3">{statusNames[run.status]}</td>
      <td className="border-b p-3">{phaseName(run.phase)}</td><td className="whitespace-nowrap border-b p-3">{duration(run.durationMs)}</td>
      <td className="border-b p-3"><DetailLink href={href(run.id)}>Ver ejecución <span className="sr-only">del {timestamp(run.startedAt)}, intento {run.attemptNo}</span></DetailLink></td>
    </tr>)}</tbody>
  </table></div>;
}
