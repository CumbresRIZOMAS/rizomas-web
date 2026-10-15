import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useApiQuery } from '../../shared/api/hooks'
import type { Farm, FarmDetail, Labor } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { RequireFarm } from '../../shared/farm/RequireFarm'
import { formatNumber } from '../../shared/format'
import { harvests, harvestTotal, mainUnit } from '../../shared/harvest'
import { Button, Card, ErrorNotice, Kpi, Loading, PageHeader } from '../../shared/ui'
import { CosechasTable } from './CosechasTable'

export function CosechasPage() {
  return <RequireFarm>{(farm) => <Cosechas farm={farm} />}</RequireFarm>
}

function Cosechas({ farm }: { farm: Farm }) {
  const navigate = useNavigate()
  const { role } = useAuth()
  const detalle = useApiQuery<FarmDetail>(`/farms/${farm.id}`)
  const labores = useApiQuery<Labor[]>(`/farms/${farm.id}/labors`)
  const lista = labores.data ?? []
  const unidad = mainUnit(lista)
  const [ahora] = useState(() => new Date())
  const inicioMes = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), 1))
  const inicioAnio = new Date(Date.UTC(ahora.getFullYear(), 0, 1))
  const eventosAnio = harvests(lista).filter((h) => new Date(h.labor.startDate) >= inicioAnio).length
  const lotName = (id: string) => detalle.data?.lots.find((l) => l.id === id)?.name

  return (
    <div>
      <PageHeader
        eyebrow="Producción"
        title="Cosechas"
        subtitle="Seguimiento de recolecciones y rendimiento por lote."
        actions={
          canDo(role, ROLES.registrarEnFinca) && (
            <Button icon="plus" onClick={() => navigate('/labores/nueva?tipo=cosecha')}>
              Registrar cosecha
            </Button>
          )
        }
      />
      {labores.loading && !labores.data && <Loading />}
      {labores.error && <ErrorNotice message={labores.error} onRetry={labores.reload} />}
      {labores.data && (
        <>
          <div className="kpi-grid commerce-kpis">
            <Kpi label="Total este mes" value={`${formatNumber(harvestTotal(lista, unidad, inicioMes))} ${unidad}`} detail={`Finca ${farm.name}`} icon="coffee" tone="coffee" />
            <Kpi label={`Total ${ahora.getFullYear()}`} value={`${formatNumber(harvestTotal(lista, unidad, inicioAnio))} ${unidad}`} detail="Desde el 1 de enero" icon="sync" tone="moss" />
            <Kpi label="Eventos de cosecha" value={String(eventosAnio)} detail={`Registrados en ${ahora.getFullYear()}`} icon="calendar" tone="blue" />
          </div>
          <Card>
            <CosechasTable labors={lista} lotName={lotName} />
          </Card>
        </>
      )}
    </div>
  )
}
