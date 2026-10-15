import { useState } from 'react'
import { Link } from 'react-router'
import { useApiQuery } from '../../shared/api/hooks'
import type { Farm, FarmDetail } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { RequireFarm } from '../../shared/farm/RequireFarm'
import { formatDate, formatHa } from '../../shared/format'
import { Button, Card, Chip, ErrorNotice, Icon, Loading, PageHeader } from '../../shared/ui'
import { LoteForm } from './LoteForm'

export function LotesPage() {
  return <RequireFarm>{(farm) => <Lotes farm={farm} />}</RequireFarm>
}

function Lotes({ farm }: { farm: Farm }) {
  const { role } = useAuth()
  const { data, error, loading, reload } = useApiQuery<FarmDetail>(`/farms/${farm.id}`)
  const [creando, setCreando] = useState(false)
  const puedeRegistrar = canDo(role, ROLES.registrarEnFinca)

  return (
    <div>
      <PageHeader
        eyebrow={`Finca ${farm.name}`}
        title="Lotes y cultivos"
        subtitle="Organiza las áreas productivas y cultivos de la finca."
        actions={
          puedeRegistrar &&
          !creando && (
            <Button icon="plus" onClick={() => setCreando(true)}>
              Registrar lote
            </Button>
          )
        }
      />
      <div className="stack">
        {creando && (
          <LoteForm
            farmId={farm.id}
            onCancel={() => setCreando(false)}
            onSaved={() => {
              setCreando(false)
              reload()
            }}
          />
        )}
        {loading && !data && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {data && (
          <div className="lot-grid">
            {data.lots.map((lote) => (
              <Card className="lot-card" key={lote.id}>
                <div className="lot-visual">
                  <Icon name="leaf" size={34} />
                  <span>{formatHa(lote.areaHa)}</span>
                </div>
                <div className="lot-content">
                  <div>
                    <h3>{lote.name}</h3>
                    <Chip tone={lote.crops.length ? 'green' : 'gray'}>{lote.crops.length ? 'Activo' : 'Sin cultivo'}</Chip>
                  </div>
                  <p>{lote.identifier ?? 'Sin identificador'}</p>
                  <div className="lot-stats">
                    {lote.crops.length === 0 && (
                      <span>
                        <small>Cultivos</small>
                        <strong>Ninguno registrado</strong>
                      </span>
                    )}
                    {lote.crops.slice(0, 2).map((c) => (
                      <span key={c.id}>
                        <small>{c.species}</small>
                        <strong>
                          {c.variety ?? 'Sin variedad'}
                          {c.plantingDate && ` · ${formatDate(c.plantingDate)}`}
                        </strong>
                      </span>
                    ))}
                  </div>
                  <Link className="btn btn-secondary" to={`/lotes/${lote.id}`}>
                    Ver detalle
                  </Link>
                </div>
              </Card>
            ))}
            {puedeRegistrar && !creando && (
              <button type="button" className="add-card" onClick={() => setCreando(true)}>
                <Icon name="plus" />
                <strong>Agregar lote</strong>
                <span>Registra un nuevo lote en esta finca</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
