import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useApiQuery } from '../../shared/api/hooks'
import type { FarmDetail, Labor } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { useActiveFarm } from '../../shared/farm/context'
import { FARM_TYPE_LABEL, FARM_TYPE_TONE, formatDate, formatHa, formatNumber } from '../../shared/format'
import { Button, Card, Chip, ErrorNotice, Icon, Loading, PageHeader, Tabs } from '../../shared/ui'
import { ComercialPanel } from '../comercial/ComercialPanel'
import { CosechasTable } from '../cosechas/CosechasTable'
import { LaborTimeline } from '../labores/LaborTimeline'
import { LoteForm } from '../lotes/LoteForm'
import { FincaForm } from './FincaForm'

type Tab = 'lotes' | 'labores' | 'cosechas' | 'comercial'

export function FincaDetailPage() {
  const { farmId = '' } = useParams()
  const { role } = useAuth()
  const navigate = useNavigate()
  const { setFarmId, reload: recargarFincas } = useActiveFarm()
  const { data: finca, error, loading, reload } = useApiQuery<FarmDetail>(`/farms/${farmId}`)
  const labores = useApiQuery<Labor[]>(`/farms/${farmId}/labors`)
  const [tab, setTab] = useState<Tab>('lotes')
  const [editando, setEditando] = useState(false)
  const [creandoLote, setCreandoLote] = useState(false)

  if (loading && !finca) return <Loading />
  if (error) return <ErrorNotice message={error} onRetry={reload} />
  if (!finca) return null

  const lotName = (id: string) => finca.lots.find((l) => l.id === id)?.name
  const listaLabores = labores.data ?? []
  const delLote = (lotId: string) => {
    const crops = new Set(finca.lots.find((l) => l.id === lotId)?.crops.map((c) => c.id))
    return listaLabores.filter((l) => l.lotId === lotId || (l.cropId !== null && crops.has(l.cropId)))
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'lotes', label: `Lotes (${finca.lots.length})` },
    { id: 'labores', label: 'Labores' },
    { id: 'cosechas', label: 'Cosechas' },
  ]
  if (canDo(role, ROLES.verComercial)) tabs.push({ id: 'comercial', label: 'Compras y ventas' })

  function nuevaLabor() {
    setFarmId(finca!.id)
    navigate('/labores/nueva')
  }

  return (
    <div>
      <PageHeader
        breadcrumb={
          <>
            <Link to="/fincas">Fincas</Link> / <span>{finca.name}</span>
          </>
        }
        title={`Finca ${finca.name}`}
        subtitle={[finca.municipality, finca.region].filter(Boolean).join(', ') || undefined}
        actions={
          <>
            {canDo(role, ROLES.editarFinca) && !editando && (
              <Button variant="secondary" onClick={() => setEditando(true)}>
                Editar datos
              </Button>
            )}
            {canDo(role, ROLES.registrarEnFinca) && (
              <Button icon="plus" onClick={nuevaLabor}>
                Nueva labor
              </Button>
            )}
          </>
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
              recargarFincas()
            }}
          />
        )}
        <div className="detail-hero">
          <div className="farm-monogram">
            <Icon name="farm" size={34} />
          </div>
          <div>
            <span>Propietario</span>
            <strong>{finca.owner?.name ?? 'Sin asignar'}</strong>
          </div>
          <div>
            <span>Área total</span>
            <strong>{formatHa(finca.areaHa)}</strong>
          </div>
          <div>
            <span>Clima</span>
            <strong>{finca.climate ?? 'Sin registrar'}</strong>
          </div>
          <div>
            <span>Identificador</span>
            <strong>{finca.identifier ?? '—'}</strong>
          </div>
          <Chip tone={FARM_TYPE_TONE[finca.farmType]}>{FARM_TYPE_LABEL[finca.farmType]}</Chip>
        </div>
      </div>
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'lotes' && (
        <div className="stack">
          {creandoLote && (
            <LoteForm
              farmId={finca.id}
              onCancel={() => setCreandoLote(false)}
              onSaved={() => {
                setCreandoLote(false)
                reload()
              }}
            />
          )}
          <div className="lot-grid">
            {finca.lots.map((lote) => {
              const suyas = delLote(lote.id)
              const ultima = suyas[0]
              const cosecha = suyas.find((l) => l.harvest)
              const cultivo = lote.crops[0]
              return (
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
                    <p>
                      {cultivo
                        ? `${[cultivo.species, cultivo.variety].filter(Boolean).join(' ')}${cultivo.plantingDate ? ` · Siembra ${new Date(cultivo.plantingDate).getUTCFullYear()}` : ''}`
                        : 'Sin cultivos registrados'}
                      {lote.crops.length > 1 && ` · +${lote.crops.length - 1}`}
                    </p>
                    <div className="lot-stats">
                      <span>
                        <small>Última labor</small>
                        <strong>{ultima ? `${ultima.name} · ${formatDate(ultima.startDate)}` : '—'}</strong>
                      </span>
                      <span>
                        <small>Última cosecha</small>
                        <strong>{cosecha?.harvest ? `${formatNumber(cosecha.harvest.quantity)} ${cosecha.harvest.unit}` : '—'}</strong>
                      </span>
                    </div>
                    <Link className="btn btn-secondary" to={`/lotes/${lote.id}`}>
                      Ver detalle
                    </Link>
                  </div>
                </Card>
              )
            })}
            {canDo(role, ROLES.registrarEnFinca) && !creandoLote && (
              <button type="button" className="add-card" onClick={() => setCreandoLote(true)}>
                <Icon name="plus" />
                <strong>Agregar lote</strong>
                <span>Registra un nuevo lote en esta finca</span>
              </button>
            )}
          </div>
        </div>
      )}

      {tab !== 'lotes' && tab !== 'comercial' && labores.error && <ErrorNotice message={labores.error} onRetry={labores.reload} />}
      {tab !== 'lotes' && tab !== 'comercial' && labores.loading && !labores.data && <Loading />}
      {tab === 'labores' && labores.data && <LaborTimeline labors={listaLabores} lotName={lotName} />}
      {tab === 'cosechas' && labores.data && (
        <Card>
          <CosechasTable labors={listaLabores} lotName={lotName} />
        </Card>
      )}
      {tab === 'comercial' && <ComercialPanel farmId={finca.id} />}
    </div>
  )
}
