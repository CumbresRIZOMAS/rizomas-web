import type { Labor } from '../../shared/api/types'
import { formatDate, formatNumber } from '../../shared/format'
import { Empty } from '../../shared/ui'
import { laborPlace } from '../labores/laborVisual'

/** Historial de cosechas (RF-07): fecha, origen, cantidad y calidad. */
export function CosechasTable({ labors, lotName }: { labors: Labor[]; lotName: (id: string) => string | undefined }) {
  const cosechas = labors.filter((l) => l.type === 'COSECHA' && l.harvest)
  if (cosechas.length === 0) return <Empty title="Sin cosechas registradas">Las cosechas se registran como labor sobre un cultivo.</Empty>
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Cosecha</th>
            <th>Origen</th>
            <th>Cantidad</th>
            <th>Calidad</th>
          </tr>
        </thead>
        <tbody>
          {cosechas.map((l) => (
            <tr key={l.id}>
              <td className="num">{formatDate(l.startDate)}</td>
              <td>
                <strong>{l.name}</strong>
              </td>
              <td>{laborPlace(l, lotName)}</td>
              <td className="num">
                <strong>
                  {formatNumber(l.harvest!.quantity)} {l.harvest!.unit}
                </strong>
              </td>
              <td>{l.harvest!.quality ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
