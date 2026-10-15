import { useState } from 'react'
import { useApiQuery } from '../../shared/api/hooks'
import type { Farm, Labor, ProductionReport } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { MiniBars } from '../../shared/charts'
import { RequireFarm } from '../../shared/farm/RequireFarm'
import { formatLongDate, formatMoney, formatNumber, MONTHS } from '../../shared/format'
import { harvests, mainUnit } from '../../shared/harvest'
import { Button, Card, Empty, ErrorNotice, Icon, Loading, PageHeader, SelectField, TextField } from '../../shared/ui'

const TIPOS = [
  { id: 'production', label: 'Productivo', disponible: true },
  { id: 'ambiental', label: 'Ambiental', disponible: false },
  { id: 'tecnico', label: 'Técnico', disponible: false },
  { id: 'social', label: 'Social', disponible: false },
  { id: 'comercial', label: 'Comercial', disponible: false },
  { id: 'trazabilidad', label: 'Trazabilidad', disponible: false },
]

export function ReportesPage() {
  return <RequireFarm>{(farm) => <Reportes key={farm.id} farm={farm} />}</RequireFarm>
}

function inicioDeAnio(): string {
  return `${new Date().getFullYear()}-01-01`
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Reportes (RF-20). Por ahora el backend genera el productivo; los demás tipos quedan listados como pendientes. */
function Reportes({ farm }: { farm: Farm }) {
  const { role } = useAuth()
  const [desde, setDesde] = useState(inicioDeAnio())
  const [hasta, setHasta] = useState(hoy())
  const [consulta, setConsulta] = useState<{ desde: string; hasta: string } | null>(null)
  const params = consulta ? new URLSearchParams({ farmId: farm.id, from: consulta.desde, to: `${consulta.hasta}T23:59:59` }) : null
  const reporte = useApiQuery<ProductionReport>(params ? `/reports/production?${params}` : null)
  const labores = useApiQuery<Labor[]>(consulta ? `/farms/${farm.id}/labors` : null)

  return (
    <div>
      <PageHeader
        eyebrow="Análisis y exportación"
        title="Reportes"
        subtitle="Genera informes para seguimiento, certificación o toma de decisiones."
        actions={
          <Button icon="report" disabled={!reporte.data} onClick={() => window.print()}>
            Exportar PDF
          </Button>
        }
      />
      <Card>
        <form
          className="report-controls"
          onSubmit={(e) => {
            e.preventDefault()
            setConsulta({ desde, hasta })
          }}
        >
          <SelectField label="Tipo de reporte" defaultValue="production">
            {TIPOS.map((t) => (
              <option key={t.id} value={t.id} disabled={!t.disponible}>
                {t.label}
                {!t.disponible && ' (próximamente)'}
              </option>
            ))}
          </SelectField>
          <TextField label="Fecha inicial" type="date" required value={desde} onChange={(e) => setDesde(e.target.value)} />
          <TextField label="Fecha final" type="date" required min={desde} value={hasta} onChange={(e) => setHasta(e.target.value)} />
          <Button type="submit" disabled={!desde || !hasta || hasta < desde}>
            Generar vista previa
          </Button>
        </form>
      </Card>
      {reporte.loading && <Loading label="Generando reporte…" />}
      {reporte.error && <ErrorNotice message={reporte.error} onRetry={reporte.reload} />}
      {reporte.data && consulta && <Vista farm={farm} reporte={reporte.data} labores={labores.data ?? []} desde={consulta.desde} hasta={consulta.hasta} verValores={canDo(role, ROLES.verComercial)} />}
    </div>
  )
}

function Vista({ farm, reporte, labores, desde, hasta, verValores }: { farm: Farm; reporte: ProductionReport; labores: Labor[]; desde: string; hasta: string; verValores: boolean }) {
  const unidad = mainUnit(labores)
  const enRango = harvests(labores).filter((h) => {
    const dia = h.labor.startDate.slice(0, 10)
    return h.unit === unidad && dia >= desde && dia <= hasta
  })
  const total = enRango.reduce((s, h) => s + h.quantity, 0)

  // Barras por mes dentro del periodo (máximo 12 meses).
  const meses: { key: string; label: string; value: number }[] = []
  const cursor = new Date(`${desde}T00:00:00Z`)
  const fin = new Date(`${hasta}T00:00:00Z`)
  while (cursor <= fin && meses.length < 12) {
    meses.push({ key: `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}`, label: MONTHS[cursor.getUTCMonth()], value: 0 })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1)
  }
  for (const h of enRango) {
    const d = new Date(h.labor.startDate)
    const mes = meses.find((m) => m.key === `${d.getUTCFullYear()}-${d.getUTCMonth()}`)
    if (mes) mes.value += h.quantity
  }

  return (
    <Card className="report-preview">
      <div className="report-head">
        <div>
          <small>REPORTE PRODUCTIVO</small>
          <h2>Finca {farm.name}</h2>
          <p>
            {formatLongDate(`${desde}T00:00:00Z`)} – {formatLongDate(`${hasta}T00:00:00Z`)}
          </p>
        </div>
        <div className="report-logo">
          <Icon name="leaf" />
          <strong>RIZOMAS</strong>
        </div>
      </div>
      <div className="report-metrics">
        <div>
          <span>Cosecha total</span>
          <strong>
            {formatNumber(total)} {unidad}
          </strong>
          <small>{reporte.totals.harvestEvents} eventos de cosecha</small>
        </div>
        <div>
          <span>Labores registradas</span>
          <strong>{reporte.totals.labors}</strong>
          <small>En el periodo seleccionado</small>
        </div>
        {verValores ? (
          <div>
            <span>Gastos / ventas</span>
            <strong>{formatMoney(reporte.totals.purchaseValue)}</strong>
            <small>Ventas: {formatMoney(reporte.totals.saleValue)}</small>
          </div>
        ) : (
          <div>
            <span>Valores comerciales</span>
            <strong>
              <Icon name="lock" size={16} />
            </strong>
            <small>Solo para administradores</small>
          </div>
        )}
      </div>
      <div className="report-chart">
        <h3>Producción mensual ({unidad})</h3>
        {total === 0 ? (
          <Empty title="Sin cosechas en el periodo" />
        ) : (
          <MiniBars values={meses.map((m) => m.value)} labels={meses.map((m) => m.label)} />
        )}
      </div>
    </Card>
  )
}
