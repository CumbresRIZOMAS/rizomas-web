import { useState } from 'react'
import { useApiQuery } from '../../shared/api/hooks'
import type { Labor, LotWithCrops } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { formatDate, formatNumber, LABOR_TYPE_LABEL, MANAGEMENT_TYPE_LABEL } from '../../shared/format'
import { Empty, ErrorNotice, Loading } from '../../shared/ui'
import { LaborForm } from './LaborForm'

/** Labores de una finca, opcionalmente filtradas a un lote. */
export function LaboresPanel({ farmId, lots, lotId }: { farmId: string; lots: LotWithCrops[]; lotId?: string }) {
  const { role } = useAuth()
  const { data, error, loading, reload } = useApiQuery<Labor[]>(`/farms/${farmId}/labors`)
  const [creando, setCreando] = useState(false)

  const cropsDelLote = new Set(lots.find((l) => l.id === lotId)?.crops.map((c) => c.id) ?? [])
  const labores = (data ?? []).filter((l) => !lotId || l.lotId === lotId || (l.cropId !== null && cropsDelLote.has(l.cropId)))

  return (
    <div className="stack">
      {creando ? (
        <LaborForm
          farmId={farmId}
          lots={lots}
          defaultLotId={lotId}
          onCancel={() => setCreando(false)}
          onSaved={() => {
            setCreando(false)
            reload()
          }}
        />
      ) : (
        canDo(role, ROLES.registrarEnFinca) && (
          <div>
            <button type="button" className="btn btn-primary" onClick={() => setCreando(true)}>
              + Registrar labor
            </button>
          </div>
        )
      )}

      <section className="card">
        {loading && !data && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {data && labores.length === 0 && <Empty title="Sin labores registradas">Las labores registradas desde la app o el panel aparecen aquí.</Empty>}
        {labores.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Labor</th>
                  <th>Tipo</th>
                  <th>Sobre</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {labores.map((l) => (
                  <tr key={l.id}>
                    <td className="num">
                      {formatDate(l.startDate)}
                      {l.endDate && l.endDate !== l.startDate && <div className="meta">a {formatDate(l.endDate)}</div>}
                    </td>
                    <td>
                      <strong>{l.name}</strong>
                      {l.observations && <div className="meta">{l.observations}</div>}
                    </td>
                    <td>
                      <span className={l.type === 'COSECHA' ? 'tag tag-earth' : 'tag tag-green'}>{LABOR_TYPE_LABEL[l.type]}</span>
                    </td>
                    <td>{l.lot ? `Lote ${l.lot.name}` : l.crop ? [l.crop.species, l.crop.variety].filter(Boolean).join(' ') : '—'}</td>
                    <td className="meta">
                      {l.harvest && `${formatNumber(l.harvest.quantity)} ${l.harvest.unit}`}
                      {l.management &&
                        [MANAGEMENT_TYPE_LABEL[l.management.type], l.management.quantity !== null && formatNumber(l.management.quantity)]
                          .filter(Boolean)
                          .join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
