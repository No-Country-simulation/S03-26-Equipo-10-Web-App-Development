import type { BiStatistics } from '../statistics-api';
import { number, percentage } from '../format';

/** Geometry is approximate; tables preserve exact decimal counts, including values above Number's safe range. */
export function MonthlyStatisticsChart({
  forecast,
}: {
  forecast: BiStatistics['forecast'];
}) {
  const rows = forecast.history;
  const values = rows.flatMap((row) =>
    row.count === null ? [] : [BigInt(row.count)],
  );
  const prediction = forecast.value;
  const max = values.reduce(
    (a, b) => (a > b ? a : b),
    prediction === null ? 1n : BigInt(Math.ceil(prediction)) || 1n,
  );
  const y = (value: bigint) =>
    150 - (Number((value * 10000n) / max) / 10000) * 120;
  const step = 480 / Math.max(1, rows.length);
  let path = '';
  let continuous = false;
  rows.forEach((row, i) => {
    if (row.count === null) {
      continuous = false;
      return;
    }
    path += `${continuous ? ' L' : ' M'}${70 + i * step},${y(BigInt(row.count))}`;
    continuous = true;
  });
  return (
    <figure className="my-5 max-w-3xl">
      <figcaption className="text-sm">
        Creaciones observadas por mes UTC. Línea continua: histórico; rombo:
        pronóstico. Los huecos representan meses sin cortes. Cantidades exactas
        en las tablas.
      </figcaption>
      <div
        className="overflow-x-auto"
        role="region"
        aria-label="Gráfico mensual de creaciones observadas"
        tabIndex={0}
      >
        <svg
          viewBox="0 0 600 210"
          className="min-w-[37.5rem] w-full text-primary"
          role="img"
          aria-label="Histórico mensual y pronóstico diferenciado"
        >
          <path
            d="M70,30 V150 H565"
            stroke="currentColor"
            fill="none"
            opacity="0.5"
          />
          <text
            x="65"
            y="30"
            textAnchor="end"
            fill="currentColor"
            fontSize="12"
          >
            {max.toString().length > 8 ? 'máximo' : number(max.toString())}
          </text>
          <text
            x="65"
            y="155"
            textAnchor="end"
            fill="currentColor"
            fontSize="12"
          >
            0
          </text>
          <path d={path} stroke="currentColor" strokeWidth="2" fill="none" />
          {rows.map((row, i) =>
            row.count === null ? null : (
              <circle
                key={row.month}
                cx={70 + i * step}
                cy={y(BigInt(row.count))}
                r="3"
                fill="currentColor"
              >
                <title>
                  {row.month}: {number(row.count)} observados
                </title>
              </circle>
            ),
          )}
          {prediction !== null && (
            <g>
              <path
                d="M550,30 V160"
                stroke="currentColor"
                strokeDasharray="4 4"
              />
              <path
                d="M-5,0 L0,-5 L5,0 L0,5 Z"
                transform={`translate(550,${150 - (prediction / Number(max)) * 120})`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <title>
                  {forecast.targetMonth}: {number(prediction)} estimados
                </title>
              </path>
            </g>
          )}
          <text x="70" y="185" fill="currentColor" fontSize="12">
            {rows[0]?.month ?? 'Sin histórico'}
          </text>
          <text
            x="550"
            y="185"
            textAnchor="end"
            fill="currentColor"
            fontSize="12"
          >
            {forecast.targetMonth} (objetivo)
          </text>
        </svg>
      </div>
    </figure>
  );
}
export function AnomalyStatisticsChart({
  anomalies,
}: {
  anomalies: BiStatistics['anomalies'];
}) {
  const dates = [...new Set(anomalies.items.map((row) => row.date))];
  return (
    <figure className="my-5 max-w-3xl">
      <figcaption className="text-sm">
        Proporciones del inventario diario, todos los estados. Círculos sin
        relleno: aumentos señalados. Sin corte no se dibuja un cero.
      </figcaption>
      <div
        className="overflow-x-auto"
        role="region"
        aria-label="Gráfico de proporciones diarias"
        tabIndex={0}
      >
        <svg
          viewBox="0 0 600 210"
          className="min-w-[37.5rem] w-full text-primary"
          role="img"
          aria-label="Rechazados: línea continua. Valoraciones bajas: línea discontinua. Escala de cero a cien por ciento."
        >
          <path
            d="M65,30 V150 H565"
            stroke="currentColor"
            fill="none"
            opacity="0.5"
          />
          {[0, 0.5, 1].map((value) => (
            <text
              key={value}
              x="58"
              y={154 - value * 120}
              textAnchor="end"
              fill="currentColor"
              fontSize="12"
            >
              {percentage(value * 100)}
            </text>
          ))}
          {(['rejected_share', 'low_rating_share'] as const).map((metric) => {
            let path = '';
            let continuous = false;
            const rows = anomalies.items.filter((row) => row.metric === metric);
            return (
              <g key={metric}>
                {rows.map((row, i) => {
                  const x = 65 + (i * 500) / Math.max(1, dates.length - 1);
                  if (row.ratio === null) {
                    continuous = false;
                    return null;
                  }
                  path += `${continuous ? ' L' : ' M'}${x},${150 - row.ratio * 120}`;
                  continuous = true;
                  return row.status === 'flagged' ? (
                    <circle
                      key={row.id}
                      cx={x}
                      cy={150 - row.ratio * 120}
                      r="5"
                      stroke="currentColor"
                      fill="none"
                    >
                      <title>
                        {row.date}: aumento de{' '}
                        {metric === 'rejected_share'
                          ? 'rechazados'
                          : 'valoraciones bajas'}
                      </title>
                    </circle>
                  ) : null;
                })}
                <path
                  d={path}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={
                    metric === 'low_rating_share' ? '5 4' : undefined
                  }
                  fill="none"
                />
              </g>
            );
          })}
          <text x="65" y="185" fill="currentColor" fontSize="12">
            {anomalies.from}
          </text>
          <text
            x="565"
            y="185"
            textAnchor="end"
            fill="currentColor"
            fontSize="12"
          >
            {anomalies.to}
          </text>
        </svg>
      </div>
    </figure>
  );
}
