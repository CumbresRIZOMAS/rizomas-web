import { formatNumber, MONTHS } from './format'

/** Barras mensuales del diseño (cosecha por mes). */
export function MonthBars({ values, unit }: { values: number[]; unit: string }) {
  const max = Math.max(...values, 0)
  const pico = values.indexOf(max)
  return (
    <div className="bar-chart" role="img" aria-label={`Cosecha por mes en ${unit}`}>
      {values.map((v, i) => (
        <div className="bar-col" key={MONTHS[i]}>
          <span className="bar-value">
            {formatNumber(v)} {unit}
          </span>
          <div
            className="bar"
            style={{ height: max > 0 ? `${Math.max((v / max) * 100, 4)}%` : '4%', background: i === pico && max > 0 ? 'var(--moss)' : undefined }}
          />
          <small>{MONTHS[i]}</small>
        </div>
      ))}
    </div>
  )
}

export function MiniBars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 0)
  return (
    <div className="mini-bars">
      {values.map((v, i) => (
        <div key={labels[i]} title={formatNumber(v)}>
          <i style={{ height: max > 0 ? `${Math.max((v / max) * 100, 3)}%` : '3%' }} />
          <span>{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}
