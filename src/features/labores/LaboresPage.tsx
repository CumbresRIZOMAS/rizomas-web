import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useApiQuery } from '../../shared/api/hooks'
import type { Farm, FarmDetail, Labor, LaborType } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { RequireFarm } from '../../shared/farm/RequireFarm'
import { LABOR_TYPE_LABEL } from '../../shared/format'
import { Button, Card, ErrorNotice, Loading, PageHeader, SelectField, TextField } from '../../shared/ui'
import { LaborTimeline } from './LaborTimeline'

export function LaboresPage() {
  return <RequireFarm>{(farm) => <Historial farm={farm} />}</RequireFarm>
}

function Historial({ farm }: { farm: Farm }) {
  const navigate = useNavigate()
  const { role } = useAuth()
  const detalle = useApiQuery<FarmDetail>(`/farms/${farm.id}`)
  const labores = useApiQuery<Labor[]>(`/farms/${farm.id}/labors`)
  const [tipo, setTipo] = useState<LaborType | ''>('')
  const [lotId, setLotId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const lots = detalle.data?.lots ?? []
  const lotName = (id: string) => lots.find((l) => l.id === id)?.name
  const cropsDelLote = new Set(lots.find((l) => l.id === lotId)?.crops.map((c) => c.id) ?? [])
  const filtradas = (labores.data ?? []).filter((l) => {
    const dia = l.startDate.slice(0, 10)
    return (
      (!tipo || l.type === tipo) &&
      (!lotId || l.lotId === lotId || (l.cropId !== null && cropsDelLote.has(l.cropId))) &&
      (!desde || dia >= desde) &&
      (!hasta || dia <= hasta)
    )
  })

  return (
    <div>
      <PageHeader
        eyebrow={`Finca ${farm.name}`}
        title="Historial de labores"
        subtitle="Consulta todas las actividades registradas en la finca."
        actions={
          canDo(role, ROLES.registrarEnFinca) && (
            <Button icon="plus" onClick={() => navigate('/labores/nueva')}>
              Registrar labor
            </Button>
          )
        }
      />
      <Card>
        <div className="filter-bar compact">
          <SelectField label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as LaborType | '')}>
            <option value="">Todos</option>
            {Object.entries(LABOR_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Lote" value={lotId} onChange={(e) => setLotId(e.target.value)}>
            <option value="">Todos</option>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </SelectField>
          <TextField label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <TextField label="Hasta" type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </Card>
      {labores.loading && !labores.data && <Loading />}
      {labores.error && <ErrorNotice message={labores.error} onRetry={labores.reload} />}
      {labores.data && <LaborTimeline labors={filtradas} lotName={lotName} />}
    </div>
  )
}
