import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useApiQuery } from '../../shared/api/hooks'
import type { Farm, FarmDetail, FarmType, Labor, Ledger, SoilAnalysis } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { MonthBars } from '../../shared/charts'
import { RequireFarm } from '../../shared/farm/RequireFarm'
import {
  DIAGNOSIS_LABEL,
  FARM_TYPE_LABEL,
  FARM_TYPE_TONE,
  formatHa,
  formatLongDate,
  formatMoneyShort,
  formatNumber,
  formatShortDate,
  toNumber,
} from '../../shared/format'
import { harvestByMonth, harvestTotal, harvestYears, mainUnit } from '../../shared/harvest'
import { Button, Card, CardTitle, Chip, Empty, ErrorNotice, Icon, Kpi, Loading, PageHeader } from '../../shared/ui'
import { laborIcon, laborPlace } from '../labores/laborVisual'

/** Avance hacia lo regenerativo, en tramos de 5 (barra del diseño). */
const TRAMOS: Record<FarmType, number> = { CONVENCIONAL: 1, EN_TRANSICION: 3, REGENERATIVA: 5 }

function saludo(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

export function InicioPage() {
  return <RequireFarm>{(farm) => <Dashboard farm={farm} />}</RequireFarm>
}

function Dashboard({ farm }: { farm: Farm }) {
  const navigate = useNavigate()
  const { role } = useAuth()
  const verComercial = canDo(role, ROLES.verComercial)
  const detalle = useApiQuery<FarmDetail>(`/farms/${farm.id}`)
  const labores = useApiQuery<Labor[]>(`/farms/${farm.id}/labors`)
  const suelos = useApiQuery<SoilAnalysis[]>(`/farms/${farm.id}/soil-analyses`)
  const ledger = useApiQuery<Ledger>(verComercial ? `/commercial/farms/${farm.id}/ledger` : null)
  const [hoy] = useState(() => new Date())
  const [year, setYear] = useState(() => hoy.getFullYear())

  if (detalle.loading && !detalle.data) return <Loading />
  if (detalle.error) return <ErrorNotice message={detalle.error} onRetry={detalle.reload} />
  const f = detalle.data
  if (!f) return null

  const lotName = (id: string) => f.lots.find((l) => l.id === id)?.name
  const cultivos = f.lots.flatMap((l) => l.crops)
  const variedades = [...new Set(cultivos.map((c) => c.variety).filter(Boolean))]
  const listaLabores = labores.data ?? []
  const unidad = mainUnit(listaLabores)
  const inicioAnio = new Date(Date.UTC(year, 0, 1))
  const finAnio = new Date(Date.UTC(year, 11, 31, 23, 59))
  const cosechaAnio = harvestTotal(listaLabores, unidad, inicioAnio, finAnio)
  const cosechaAnterior = harvestTotal(listaLabores, unidad, new Date(Date.UTC(year - 1, 0, 1)), new Date(Date.UTC(year - 1, 11, 31, 23, 59)))
  const variacion = cosechaAnterior > 0 ? Math.round(((cosechaAnio - cosechaAnterior) / cosechaAnterior) * 100) : null

  // Alertas: diagnósticos fuera de rango del análisis más reciente de cada lote.
  const recientes = new Map<string, SoilAnalysis>()
  for (const a of suelos.data ?? []) {
    const key = a.lotId ?? 'finca'
    if (!recientes.has(key)) recientes.set(key, a)
  }
  const alertas = [...recientes.values()].flatMap((a) =>
    a.diagnostics.filter((d) => d.status === 'BAJO' || d.status === 'ALTO').map((d) => ({ analisis: a, diagnostico: d })),
  )

  const compras = (ledger.data?.purchases ?? []).filter((p) => new Date(p.date) >= inicioAnio && new Date(p.date) <= finAnio)
  const gastos = compras.reduce((s, p) => s + (toNumber(p.value) ?? 0), 0)
  const gastoBio = compras.filter((p) => p.isBioinput).reduce((s, p) => s + (toNumber(p.value) ?? 0), 0)

  return (
    <div>
      <PageHeader
        eyebrow={`Finca ${f.name}`}
        title={saludo()}
        subtitle={`Este es el estado de la finca hoy, ${formatLongDate(hoy)}.`}
        actions={
          <Button icon="plus" onClick={() => navigate('/labores/nueva')}>
            Registrar labor
          </Button>
        }
      />
      <div className="farm-state">
        <div>
          <Icon name="leaf" />
          <span>Estado de transición regenerativa</span>
        </div>
        <div className="state-track" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <i key={n} className={n <= TRAMOS[f.farmType] ? 'on' : ''} />
          ))}
        </div>
        <Chip tone={FARM_TYPE_TONE[f.farmType]}>{FARM_TYPE_LABEL[f.farmType]}</Chip>
      </div>
      <div className="kpi-grid" style={verComercial ? undefined : { gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        <Kpi label="Área total" value={formatHa(f.areaHa)} detail={`${f.lots.length} ${f.lots.length === 1 ? 'lote' : 'lotes'}`} icon="farm" />
        <Kpi label="Cultivos activos" value={String(cultivos.length)} detail={variedades.join(' y ') || 'Sin variedades registradas'} icon="leaf" tone="moss" />
        <Kpi
          label={`Cosecha ${year}`}
          value={`${formatNumber(cosechaAnio)} ${unidad}`}
          detail={variacion === null ? 'Sin año anterior para comparar' : `${variacion >= 0 ? '+' : ''}${variacion}% frente a ${year - 1}`}
          icon="coffee"
          tone="coffee"
        />
        {verComercial && (
          <>
            <Kpi label={`Gastos ${year}`} value={formatMoneyShort(gastos)} detail={`${compras.length} compras registradas`} icon="wallet" tone="blue" />
            <Kpi
              label="Compras bioinsumos"
              value={gastos > 0 ? `${Math.round((gastoBio / gastos) * 100)}%` : '—'}
              detail="Del valor total de compras"
              icon="drop"
              tone="moss"
            />
          </>
        )}
      </div>
      <div className="dashboard-grid">
        <Card className="chart-card">
          <CardTitle title="Cosecha por mes" subtitle={`${unidad} cosechados · ${year}`}>
            <select aria-label="Año" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 'auto' }}>
              {harvestYears(listaLabores).map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </CardTitle>
          {labores.error ? <ErrorNotice message={labores.error} onRetry={labores.reload} /> : <MonthBars values={harvestByMonth(listaLabores, year, unidad)} unit={unidad} />}
        </Card>
        <Card className="alerts-card">
          <CardTitle title="Alertas de suelo" subtitle={alertas.length ? `${alertas.length} requieren tu atención` : 'Último análisis de cada lote'}>
            <button type="button" className="text-link" onClick={() => navigate('/suelos')}>
              Ver todas <Icon name="arrow" size={15} />
            </button>
          </CardTitle>
          {suelos.error && <ErrorNotice message={suelos.error} onRetry={suelos.reload} />}
          {suelos.data && alertas.length === 0 && (
            <Empty title={suelos.data.length ? 'Sin parámetros fuera de rango' : 'Sin análisis de suelo'}>
              {suelos.data.length ? 'Todos los parámetros del último análisis están en rango o sin referencia.' : 'Registra un análisis para ver alertas aquí.'}
            </Empty>
          )}
          {alertas.slice(0, 4).map(({ analisis, diagnostico }) => (
            <div className="alert-row" key={diagnostico.id}>
              <div className={`alert-icon ${diagnostico.status === 'BAJO' ? 'low' : 'high'}`}>{diagnostico.parameter.slice(0, 2)}</div>
              <div>
                <strong>
                  {diagnostico.parameter} {diagnostico.status === 'BAJO' ? 'bajo' : 'alto'}
                </strong>
                <span>{[analisis.lot?.name ?? 'Toda la finca', analisis.laboratory].filter(Boolean).join(' · ')}</span>
                {diagnostico.recommendations[0] && <small>{diagnostico.recommendations[0].description}</small>}
              </div>
              <Chip tone={DIAGNOSIS_LABEL[diagnostico.status].tone}>{DIAGNOSIS_LABEL[diagnostico.status].label}</Chip>
            </div>
          ))}
        </Card>
        <Card className="tasks-card">
          <CardTitle title="Últimas labores" subtitle="Actividad reciente de la finca">
            <button type="button" className="text-link" onClick={() => navigate('/labores')}>
              Ver historial <Icon name="arrow" size={15} />
            </button>
          </CardTitle>
          {labores.loading && !labores.data && <Loading />}
          {labores.data && labores.data.length === 0 && <Empty title="Sin labores registradas" />}
          <div className="activity-list">
            {listaLabores.slice(0, 4).map((l) => (
              <div className="activity" key={l.id}>
                <div className="activity-icon">
                  <Icon name={laborIcon(l)} />
                </div>
                <div>
                  <strong>{l.name}</strong>
                  <span>{laborPlace(l, lotName)}</span>
                </div>
                <small>{formatShortDate(l.startDate)}</small>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
