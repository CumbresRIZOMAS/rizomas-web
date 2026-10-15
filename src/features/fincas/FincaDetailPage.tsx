import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useApiQuery } from '../../shared/api/hooks'
import type { FarmDetail } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { FARM_TYPE_LABEL, formatHa } from '../../shared/format'
import { Empty, ErrorNotice, Loading, PageHeader, Tabs } from '../../shared/ui'
import { LaboresPanel } from '../labores/LaboresPanel'
import { LoteForm } from '../lotes/LoteForm'
import { FincaForm } from './FincaForm'

type Tab = 'lotes' | 'labores'

export function FincaDetailPage() {
  const { farmId = '' } = useParams()
  const { role } = useAuth()
  const { data: finca, error, loading, reload } = useApiQuery<FarmDetail>(`/farms/${farmId}`)
  const [tab, setTab] = useState<Tab>('lotes')
  const [editando, setEditando] = useState(false)
  const [creandoLote, setCreandoLote] = useState(false)

  if (loading && !finca) return <Loading />
  if (error) return <ErrorNotice message={error} onRetry={reload} />
  if (!finca) return null

  const totalCultivos = finca.lots.reduce((n, l) => n + l.crops.length, 0)

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/fincas">Fincas</Link>}
        eyebrow={FARM_TYPE_LABEL[finca.farmType]}
        title={finca.name}
        subtitle={[finca.municipality, finca.region].filter(Boolean).join(', ') || undefined}
        actions={
          canDo(role, ROLES.editarFinca) &&
          !editando && (
            <button type="button" className="btn btn-secondary" onClick={() => setEditando(true)}>
              Editar datos
            </button>
          )
        }
      />

      <div className="stack">
        {editando && (
          <FincaForm
            title="Editar finca"
            finca={finca}
            onCancel={() => setEditando(false)}
            onSaved={() => {
              setEditando(false)
              reload()
            }}
          />
        )}

        <section className="card stats" aria-label="Resumen">
          <div className="stat">
            <strong>{finca.lots.length}</strong>
            <span>Lotes</span>
          </div>
          <div className="stat">
            <strong>{totalCultivos}</strong>
            <span>Cultivos</span>
          </div>
          <div className="stat">
            <strong>{formatHa(finca.areaHa)}</strong>
            <span>Área total</span>
          </div>
          {finca.climate && (
            <div className="stat">
              <strong>{finca.climate}</strong>
              <span>Clima</span>
            </div>
          )}
        </section>

        <div>
          <Tabs
            tabs={[
              { id: 'lotes', label: `Lotes (${finca.lots.length})` },
              { id: 'labores', label: 'Labores' },
            ]}
            active={tab}
            onChange={setTab}
          />

          {tab === 'lotes' && (
            <div className="stack">
              {creandoLote ? (
                <LoteForm
                  farmId={finca.id}
                  onCancel={() => setCreandoLote(false)}
                  onSaved={() => {
                    setCreandoLote(false)
                    reload()
                  }}
                />
              ) : (
                canDo(role, ROLES.registrarEnFinca) && (
                  <div>
                    <button type="button" className="btn btn-primary" onClick={() => setCreandoLote(true)}>
                      + Nuevo lote
                    </button>
                  </div>
                )
              )}
              <section className="card">
                {finca.lots.length === 0 ? (
                  <Empty title="Esta finca no tiene lotes">Agrega un lote para registrar cultivos y labores.</Empty>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Lote</th>
                          <th>Área</th>
                          <th>Cultivos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finca.lots.map((lote) => (
                          <tr key={lote.id}>
                            <td>
                              <Link className="row-link" to={`/lotes/${lote.id}`}>
                                {lote.name}
                              </Link>
                              {lote.identifier && <div className="meta">{lote.identifier}</div>}
                            </td>
                            <td className="num">{formatHa(lote.areaHa)}</td>
                            <td>
                              {lote.crops.length === 0 ? (
                                <span className="meta">Sin cultivos</span>
                              ) : (
                                <div className="tags" style={{ marginTop: 0 }}>
                                  {lote.crops.map((c) => (
                                    <span key={c.id} className="tag tag-green">
                                      {[c.species, c.variety].filter(Boolean).join(' — ')}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {tab === 'labores' && <LaboresPanel farmId={finca.id} lots={finca.lots} />}
        </div>
      </div>
    </>
  )
}
