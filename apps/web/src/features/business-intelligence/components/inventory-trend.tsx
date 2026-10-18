import type { BiDashboard } from '../api';
import { number } from '../format';

export function InventoryTrend({
  rows,
}: {
  rows: BiDashboard['testimonialSeries'];
}) {
  const max = Math.max(1, ...rows.map((row) => row.total ?? 0));
  const step = 516 / Math.max(1, rows.length - 1);
  const y = (value: number) => 150 - (value / max) * 110;
  // Separate paths at missing cuts: absence is never drawn as zero or interpolated.
  let path = '';
  let continuous = false;
  rows.forEach((row, index) => {
    if (row.total === null) {
      continuous = false;
      return;
    }
    path += `${continuous ? ' L' : ' M'}${64 + index * step},${y(row.total)}`;
    continuous = true;
  });
  const axisNumber = (value: number) =>
    max >= 10000
      ? new Intl.NumberFormat('es-AR', {
          notation: 'compact',
          maximumFractionDigits: 1,
        }).format(value)
      : number(value);
  const ticks = max > 1 ? [0, Math.floor(max / 2), max] : [0, 1];
  return (
    <figure className="mt-5 min-w-0 max-w-3xl">
      <figcaption className="text-sm">
        Cantidad de testimonios por día UTC. Los huecos indican días sin corte.
        Valores exactos en la tabla diaria.
      </figcaption>
      {rows.every((row) => row.total === null) ? (
        <p className="my-5 text-sm text-muted-foreground">
          No hay cortes para dibujar en este rango. Ampliá las fechas o consultá
          la operación de cargas.
        </p>
      ) : (
        <div
          role="region"
          aria-label="Gráfico del inventario diario"
          tabIndex={0}
          className="relative min-w-0 max-w-full overflow-x-auto overscroll-x-contain"
        >
          <svg
            viewBox="0 0 600 190"
            className="mt-3 w-full min-w-[37.5rem] text-primary"
            role="img"
            aria-label="Evolución del inventario de testimonios; escala en cantidad de testimonios y días UTC; detalle por día en la tabla"
          >
            <path
              d="M64,40 V150 H580"
              stroke="currentColor"
              opacity="0.5"
              fill="none"
            />
            <path d={path} stroke="currentColor" strokeWidth="2" fill="none" />
            {ticks.map((value) => (
              <g key={value}>
                <line
                  x1="60"
                  x2="580"
                  y1={y(value)}
                  y2={y(value)}
                  stroke="currentColor"
                  opacity="0.2"
                />
                <text
                  x="55"
                  y={y(value) + 4}
                  textAnchor="end"
                  fill="currentColor"
                  fontSize="14"
                >
                  {axisNumber(value)}
                </text>
              </g>
            ))}
            {rows.map((row, index) =>
              row.total === null ? null : (
                <circle
                  key={row.date}
                  cx={64 + index * step}
                  cy={y(row.total)}
                  r="3"
                  fill="currentColor"
                >
                  <title>
                    {row.date} UTC: {number(row.total)} testimonios
                  </title>
                </circle>
              ),
            )}
            <text x="64" y="178" fill="currentColor" fontSize="14">
              {rows[0]?.date}
            </text>
            <text
              x="580"
              y="178"
              textAnchor="end"
              fill="currentColor"
              fontSize="14"
            >
              {rows.at(-1)?.date}
            </text>
          </svg>
        </div>
      )}
    </figure>
  );
}
