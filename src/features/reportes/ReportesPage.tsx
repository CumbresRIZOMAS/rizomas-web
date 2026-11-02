import { useState } from 'react'
import type { Farm } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { RequireFarm } from '../../shared/farm/RequireFarm'
import { formatLongDate, formatMoney, formatNumber } from '../../shared/format'
import { Button, Card, Empty, ErrorNotice, Loading, PageHeader, SelectField, TextField } from '../../shared/ui'
import { useApiQuery } from '../../shared/api/hooks'

const REPORT_TYPES = [
  { id: 'production', label: 'Productivo', description: 'Labores y cosechas por periodo.' },
  { id: 'environmental', label: 'Ambiental', description: 'Mediciones y observaciones ambientales.' },
  { id: 'technical', label: 'Técnico', description: 'Labores, análisis de suelo y aplicaciones de bioinsumos.' },
  { id: 'social', label: 'Social', description: 'Personas registradas y labores asociadas.' },
  { id: 'commercial', label: 'Comercial', description: 'Compras, ventas y valores.' },
  { id: 'traceability', label: 'Trazabilidad', description: 'Procesos de café, etapas y productos.' },
] as const

type ReportType = (typeof REPORT_TYPES)[number]['id']
type ReportRow = Record<string, unknown>
type ReportTable = { key: string; title: string; rows: ReportRow[] }
type ReportResult = { type: ReportType; farmId: string; generatedAt: string; totals: Record<string, number | Record<string, number>>; [key: string]: unknown }

const ARRAY_LABELS: Record<string, string> = {
  labors: 'Labores', harvests: 'Cosechas', conditions: 'Observaciones ambientales', soilAnalyses: 'Análisis de suelo',
  bioinputApplications: 'Aplicaciones de bioinsumos', purchases: 'Compras', sales: 'Ventas', processes: 'Procesos de café',
}
const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre', type: 'Tipo', startDate: 'Inicio', endDate: 'Fin', durationMin: 'Duración (min)',
  quantity: 'Cantidad', unit: 'Unidad', quality: 'Calidad', date: 'Fecha', itemName: 'Producto', productName: 'Producto',
  value: 'Valor', observedAt: 'Fecha de observación', observations: 'Observaciones', laboratory: 'Laboratorio',
  parameters: 'Parámetros', status: 'Estado', description: 'Descripción', appliedAt: 'Fecha de aplicación',
  stage: 'Etapa actual', startedAt: 'Inicio del proceso', finishedAt: 'Fin del proceso', currentStage: 'Etapa',
  inputKg: 'Entrada (kg)', outputKg: 'Salida (kg)', waterLiters: 'Agua limpia (L)', wastewaterLiters: 'Agua residual (L)',
  compostReuse: 'Agua residual para compost', moisturePercent: 'Humedad (%)', scaScore: 'Puntaje SCA',
  destination: 'Destino', finalizedAt: 'Finalización', certifier: 'Certificadora',
  events: 'Etapas del proceso', products: 'Productos obtenidos', certifications: 'Certificaciones',
  diagnostics: 'Diagnósticos', recommendations: 'Recomendaciones', supplier: 'Proveedor', lot: 'Lote',
}
const INTERNAL_REPORT_FIELDS = new Set(['id', 'farmId', 'workerId', 'createdAt', 'updatedAt'])

export function ReportesPage() {
  return <RequireFarm>{(farm) => <Reportes key={farm.id} farm={farm} />}</RequireFarm>
}

function isoToday() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function inicioDeAnio() {
  return `${isoToday().slice(0, 4)}-01-01`
}

function Reportes({ farm }: { farm: Farm }) {
  const { role } = useAuth()
  const [type, setType] = useState<ReportType>('production')
  const [desde, setDesde] = useState(inicioDeAnio())
  const [hasta, setHasta] = useState(isoToday())
  const [consulta, setConsulta] = useState<{ type: ReportType; desde: string; hasta: string } | null>(null)
  const verComercial = canDo(role, ROLES.verComercial)
  const opciones = REPORT_TYPES.filter((item) => item.id !== 'commercial' || verComercial)
  const query = consulta ? new URLSearchParams({ farmId: farm.id, type: consulta.type, from: consulta.desde, to: consulta.hasta }) : null
  const reporte = useApiQuery<ReportResult>(query ? `/reports?${query}` : null)
  const selected = REPORT_TYPES.find((item) => item.id === type)!

  function exportarCsv() {
    if (!reporte.data) return
    const tables = reportTables(reporte.data)
    const totals = Object.entries(reporte.data.totals).flatMap(([key, value]) => typeof value === 'number'
      ? [[metricLabel(key), value] as [string, number]]
      : Object.entries(value).map(([unit, amount]) => [`${metricLabel(key)} (${unit})`, amount] as [string, number]))
    const reportInfo = REPORT_TYPES.find((item) => item.id === reporte.data?.type)
    const summary = [
      ['Reporte', reportInfo?.label ?? reporte.data.type],
      ['Finca', farm.name],
      ['Desde', consulta?.desde ?? desde],
      ['Hasta', consulta?.hasta ?? hasta],
      ...totals.map(([label, value]) => [label, formatNumber(value)]),
    ].map((row) => row.map(csvCell).join(','))
    const detail = tables.flatMap((table) => {
      const columns = tableColumns(table.rows)
      return ['', csvCell(table.title), columns.map((column) => csvCell(fieldLabel(column))).join(','), ...table.rows.map((row) => columns.map((column) => csvCell(formatValue(row[column]))).join(','))]
    })
    const csv = [...summary, ...detail].join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `rizomas-${reporte.data.type}-${desde}-${hasta}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Análisis y exportación"
        title="Reportes"
        subtitle="Genera reportes productivos, ambientales, técnicos, sociales, comerciales y de trazabilidad."
        actions={<>
          <Button icon="report" disabled={!reporte.data} variant="secondary" onClick={exportarCsv}>Descargar CSV</Button>
          <Button icon="report" disabled={!reporte.data} onClick={() => window.print()}>Exportar PDF</Button>
        </>}
      />
      <Card>
        <form className="report-controls" onSubmit={(event) => { event.preventDefault(); setConsulta({ type, desde, hasta }) }}>
          <SelectField label="Tipo de reporte" value={type} onChange={(event) => setType(event.target.value as ReportType)}>
            {opciones.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </SelectField>
          <TextField label="Fecha inicial" type="date" required value={desde} onChange={(event) => setDesde(event.target.value)} />
          <TextField label="Fecha final" type="date" required min={desde} value={hasta} onChange={(event) => setHasta(event.target.value)} />
          <Button type="submit" disabled={!desde || !hasta || hasta < desde}>Generar vista previa</Button>
        </form>
        <p className="muted" style={{ padding: '0 16px 14px', margin: 0 }}>{selected.description}</p>
      </Card>
      {reporte.loading && <Loading label="Generando reporte…" />}
      {reporte.error && <ErrorNotice message={reporte.error} onRetry={reporte.reload} />}
      {reporte.data && consulta && <Vista farm={farm} reporte={reporte.data} desde={consulta.desde} hasta={consulta.hasta} />}
    </div>
  )
}

function Vista({ farm, reporte, desde, hasta }: { farm: Farm; reporte: ReportResult; desde: string; hasta: string }) {
  const info = REPORT_TYPES.find((item) => item.id === reporte.type)!
  const tables = reportTables(reporte)
  const metrics = Object.entries(reporte.totals).flatMap(([key, value]) => typeof value === 'number'
    ? [[key, value] as [string, number]]
    : Object.entries(value).map(([unit, amount]) => [`${key} (${unit})`, amount] as [string, number]))
  return (
    <Card className="report-preview">
      <div className="report-head">
        <div><small>REPORTE {info.label.toUpperCase()}</small><h2>Finca {farm.name}</h2><p>{formatLongDate(`${desde}T00:00:00Z`)} – {formatLongDate(`${hasta}T00:00:00Z`)}</p></div>
        <div className="report-logo"><strong>RIZOMAS</strong></div>
      </div>
      <div className="report-metrics">
        {metrics.map(([label, value]) => <div key={label}><span>{metricLabel(label)}</span><strong>{label.toLowerCase().includes('value') ? formatMoney(value) : formatNumber(value)}</strong><small>En el periodo seleccionado</small></div>)}
      </div>
      {tables.length === 0
        ? <Empty title="Sin registros en el periodo seleccionado" />
        : tables.map((table) => <ReportTableView key={table.key} table={table} />)}
    </Card>
  )
}

function ReportTableView({ table }: { table: ReportTable }) {
  const columns = tableColumns(table.rows)
  return (
    <section className="report-chart report-table-section">
      <h3>{table.title}</h3>
      {columns.length === 0
        ? <p className="muted">Hay registros, pero no contienen campos para mostrar.</p>
        : <div className="report-table-scroll"><table className="report-data-table">
          <thead><tr>{columns.map((column) => <th key={column}>{fieldLabel(column)}</th>)}</tr></thead>
          <tbody>{table.rows.map((row, index) => <tr key={String(row.id ?? index)}>{columns.map((column) => <td key={column}>{formatValue(row[column])}</td>)}</tr>)}</tbody>
        </table></div>}
    </section>
  )
}

function reportTables(report: ReportResult): ReportTable[] {
  const tables = new Map<string, ReportTable>()
  for (const [key, value] of Object.entries(report)) {
    if (!Array.isArray(value)) continue
    const title = ARRAY_LABELS[key] ?? fieldLabel(key)
    const rootRows = value.filter(isRecord).map((row) => flattenScalars(row))
    if (rootRows.length) tables.set(key, { key, title, rows: rootRows })

    value.forEach((row) => {
      if (!isRecord(row)) return
      const parentContext = prefixFields(flattenScalars(row), title)
      collectNestedTables(row, key, title, parentContext, [], tables)
    })
  }
  return [...tables.values()]
}

function collectNestedTables(value: ReportRow, rootKey: string, rootTitle: string, context: ReportRow, path: string[], tables: Map<string, ReportTable>) {
  for (const [key, nested] of Object.entries(value)) {
    const nextPath = [...path, key]
    if (Array.isArray(nested)) {
      const children = nested.filter(isRecord)
      if (!children.length) continue
      const pathLabel = nextPath.map(fieldLabel).join(' · ')
      const tableKey = `${rootKey}-${nextPath.join('-')}`
      const title = `${rootTitle} · ${pathLabel}`
      const current = tables.get(tableKey) ?? { key: tableKey, title, rows: [] }
      for (const child of children) {
        const rowScalars = flattenScalars(child)
        current.rows.push({ ...context, ...rowScalars })
        collectNestedTables(child, rootKey, rootTitle, { ...context, ...prefixFields(rowScalars, pathLabel) }, nextPath, tables)
      }
      tables.set(tableKey, current)
    } else if (isRecord(nested)) {
      const nestedContext = { ...context, ...prefixFields(flattenScalars(nested), nextPath.map(fieldLabel).join(' · ')) }
      collectNestedTables(nested, rootKey, rootTitle, nestedContext, nextPath, tables)
    }
  }
}

function flattenScalars(value: ReportRow, prefix = ''): ReportRow {
  const result: ReportRow = {}
  for (const [key, item] of Object.entries(value)) {
    if (INTERNAL_REPORT_FIELDS.has(key)) continue
    const path = prefix ? `${prefix}.${key}` : key
    if (Array.isArray(item)) {
      if (item.every((entry) => !isRecord(entry) && !Array.isArray(entry))) result[path] = item.map(formatValue).join(' · ')
    } else if (isRecord(item)) {
      Object.assign(result, flattenScalars(item, path))
    } else {
      result[path] = item
    }
  }
  return result
}

function prefixFields(fields: ReportRow, prefix: string): ReportRow {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [`${prefix} · ${key}`, value]))
}

function tableColumns(rows: ReportRow[]) {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((column) => !INTERNAL_REPORT_FIELDS.has(column))
}

function isRecord(value: unknown): value is ReportRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fieldLabel(value: string) {
  return value.split(/[.·]/).map((part) => part.trim()).filter(Boolean)
    .map((part) => FIELD_LABELS[part] ?? part.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^\w/, (first) => first.toLocaleUpperCase('es'))).join(' · ')
}

function metricLabel(value: string) {
  const labels: Record<string, string> = { labors: 'Labores', harvestEvents: 'Eventos de cosecha', observations: 'Observaciones ambientales', soilAnalyses: 'Análisis de suelo', bioinputApplications: 'Aplicaciones de bioinsumos', registeredWorkers: 'Personas registradas', workersWithLabor: 'Personas con labores', assignedLaborRecords: 'Labores con persona asociada', laborMinutes: 'Minutos de labor', purchases: 'Compras', sales: 'Ventas', purchaseValue: 'Valor de compras', saleValue: 'Valor de ventas', processes: 'Procesos de café', events: 'Etapas registradas' }
  return labels[value] ?? value
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatLongDate(value)
  if (Array.isArray(value)) return value.map(formatValue).join(' · ')
  if (isRecord(value)) return Object.entries(flattenScalars(value)).map(([key, item]) => `${fieldLabel(key)}: ${formatValue(item)}`).join(' · ')
  return String(value)
}
