import type { BiDashboard } from '../api';

export function InventoryTrend({ rows }: { rows: BiDashboard['testimonialSeries'] }) {
  const max = Math.max(1, ...rows.map(row => row.total ?? 0));
  const step = 560 / Math.max(1, rows.length - 1);
  // Separate paths at missing cuts: absence is never drawn as zero or interpolated.
  let path = '';
  let continuous = false;
  rows.forEach((row, index) => {
    if (row.total === null) { continuous = false; return; }
    path += `${continuous ? ' L' : ' M'}${20 + index * step},${130 - row.total / max * 110}`;
    continuous = true;
  });
  return <svg viewBox="0 0 600 155" className="mt-4 w-full max-w-3xl text-primary" role="img" aria-label="Evolución del inventario de testimonios; detalle por día en la tabla">
    <path d="M20,20 V130 H580" stroke="currentColor" opacity="0.3" fill="none" />
    <path d={path} stroke="currentColor" strokeWidth="2" fill="none" />
    {rows.map((row, index) => row.total === null ? null : <circle key={row.date} cx={20 + index * step} cy={130 - row.total / max * 110} r="3" fill="currentColor"><title>{row.date}: {row.total}</title></circle>)}
    <text x="20" y="150" fill="currentColor" fontSize="10">{rows[0]?.date}</text><text x="580" y="150" textAnchor="end" fill="currentColor" fontSize="10">{rows.at(-1)?.date}</text>
  </svg>;
}

