import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { Bioinput, Diagnosis, Farm, FarmDetail, SoilAnalysis } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { RequireFarm } from '../../shared/farm/RequireFarm'
import { DIAGNOSIS_LABEL, formatDate, formatLongDate, formatNumber, formatShortDate, optionalText, parseOptionalNumber, toNumber } from '../../shared/format'
import { Button, Card, CardTitle, Chip, Empty, ErrorNotice, Icon, Loading, PageHeader, SelectField, TextAreaField, TextField } from '../../shared/ui'

/** Clave del selector de lote: un id de lote o los análisis de toda la finca. */
const FINCA = 'finca'

export function SuelosPage() {
  return <RequireFarm>{(farm) => <Suelos key={farm.id} farm={farm} />}</RequireFarm>
}

function Suelos({ farm }: { farm: Farm }) {
  const { role } = useAuth()
  const detalle = useApiQuery<FarmDetail>(`/farms/${farm.id}`)
  const analisis = useApiQuery<SoilAnalysis[]>(`/farms/${farm.id}/soil-analyses`)
  const [registrando, setRegistrando] = useState(false)
  const [lote, setLote] = useState<string | null>(null)
  const [analisisId, setAnalisisId] = useState<string | null>(null)

  const lots = detalle.data?.lots ?? []
  const todos = analisis.data ?? []
  // Por defecto, el lote del análisis más reciente.
  const loteActual = lote ?? (todos[0] ? (todos[0].lotId ?? FINCA) : (lots[0]?.id ?? FINCA))
  const delLote = todos.filter((a) => (a.lotId ?? FINCA) === loteActual)
  const actual = delLote.find((a) => a.id === analisisId) ?? delLote[0] ?? null
  const nombreLote = loteActual === FINCA ? 'Toda la finca' : (lots.find((l) => l.id === loteActual)?.name ?? 'Lote')

  if (registrando)
    return (
      <AnalisisForm
        farm={farm}
        lots={lots.map((l) => ({ id: l.id, name: l.name }))}
        defaultLot={loteActual === FINCA ? '' : loteActual}
        onCancel={() => setRegistrando(false)}
        onSaved={(nuevo) => {
          setRegistrando(false)
          setLote(nuevo.lotId ?? FINCA)
          setAnalisisId(nuevo.id)
          analisis.reload()
        }}
      />
    )

  return (
    <div>
      <PageHeader
        eyebrow={`Finca ${farm.name} / ${nombreLote}`}
        title="Análisis de suelo"
        subtitle={actual ? `Último análisis: ${formatLongDate(delLote[0].date)}${delLote[0].laboratory ? ` · ${delLote[0].laboratory}` : ''}` : 'Sin análisis registrados para esta selección.'}
        actions={
          <>
            {canDo(role, ROLES.verRangosSuelo) && (
              <Link className="btn btn-secondary" to="/suelos/rangos">
                Rangos de referencia
              </Link>
            )}
            {canDo(role, ROLES.registrarSuelo) && (
              <Button icon="plus" onClick={() => setRegistrando(true)}>
                Registrar análisis
              </Button>
            )}
          </>
        }
      />
      {(analisis.loading && !analisis.data) || (detalle.loading && !detalle.data) ? <Loading /> : null}
      {analisis.error && <ErrorNotice message={analisis.error} onRetry={analisis.reload} />}
      {analisis.data && (
        <div className="soil-layout">
          <div>
            <Card>
              <CardTitle title="Resultados del diagnóstico" subtitle={actual ? `${actual.diagnostics.length} parámetros analizados` : 'Selecciona un lote'}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    aria-label="Lote"
                    value={loteActual}
                    onChange={(e) => {
                      setLote(e.target.value)
                      setAnalisisId(null)
                    }}
                    style={{ width: 'auto' }}
                  >
                    {lots.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                    <option value={FINCA}>Toda la finca</option>
                  </select>
                  {delLote.length > 0 && (
                    <select aria-label="Fecha del análisis" value={actual?.id} onChange={(e) => setAnalisisId(e.target.value)} style={{ width: 'auto' }}>
                      {delLote.map((a) => (
                        <option key={a.id} value={a.id}>
                          {formatDate(a.date)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </CardTitle>
              {actual ? (
                <ResultadosTabla diagnostics={actual.diagnostics} />
              ) : (
                <Empty title="Sin análisis para este lote">Registra los resultados que entrega el laboratorio para obtener el diagnóstico.</Empty>
              )}
              {actual?.observations && <p className="disclaimer">Observaciones: {actual.observations}</p>}
            </Card>
            <HistoricoCard analisis={delLote} />
          </div>
          <Recomendaciones farmId={farm.id} analisis={actual} onSaved={analisis.reload} />
        </div>
      )}
    </div>
  )
}

/** Posición (0-100) del valor en la barra: 40-70 es el rango óptimo del diseño. */
function posicion(d: Diagnosis): number | null {
  const v = toNumber(d.value)
  let min = toNumber(d.referenceMin)
  let max = toNumber(d.referenceMax)
  if (v === null || (min === null && max === null)) return null
  min ??= max! / 2
  max ??= min * 1.5
  const span = max - min || 1
  if (v < min) return 40 * (1 - Math.min((min - v) / span, 1))
  if (v > max) return 70 + 30 * Math.min((v - max) / span, 1)
  return 40 + (30 * (v - min)) / span
}

function rango(d: Diagnosis): string {
  const min = toNumber(d.referenceMin)
  const max = toNumber(d.referenceMax)
  if (min === null && max === null) return 'Sin rango de referencia'
  const unidad = d.unit ? ` ${d.unit}` : ''
  if (min === null) return `Hasta ${formatNumber(max)}${unidad}`
  if (max === null) return `Desde ${formatNumber(min)}${unidad}`
  return `${formatNumber(min)} – ${formatNumber(max)}${unidad}`
}

function ResultadosTabla({ diagnostics }: { diagnostics: Diagnosis[] }) {
  return (
    <div className="soil-table">
      <div className="soil-head">
        <span>Parámetro</span>
        <span>Valor</span>
        <span>Rango de referencia</span>
        <span>Estado</span>
      </div>
      {diagnostics.map((d) => {
        const pos = posicion(d)
        const estado = DIAGNOSIS_LABEL[d.status] ?? { label: d.status, tone: 'gray' as const }
        return (
          <div className="soil-row" key={d.id}>
            <strong>{d.parameter}</strong>
            <span>
              {formatNumber(d.value)} {d.unit ?? ''}
            </span>
            <div>
              <span>{rango(d)}</span>
              <div className={`range ${pos === null ? 'no-ref' : ''}`}>{pos !== null && <i style={{ left: `${pos}%` }} />}</div>
            </div>
            <Chip tone={estado.tone}>{estado.label}</Chip>
          </div>
        )
      })}
    </div>
  )
}

/** Evolución de un parámetro en los análisis del lote (más antiguo → más reciente). */
function HistoricoCard({ analisis }: { analisis: SoilAnalysis[] }) {
  const parametros = [...new Set(analisis.flatMap((a) => a.diagnostics.map((d) => d.parameter)))]
  const [elegido, setElegido] = useState<string | null>(null)
  const parametro = elegido && parametros.includes(elegido) ? elegido : (parametros.find((p) => p.toLowerCase() === 'ph') ?? parametros[0])
  const puntos = [...analisis]
    .reverse()
    .slice(-6)
    .flatMap((a) => {
      const v = toNumber(a.diagnostics.find((d) => d.parameter === parametro)?.value)
      return v === null ? [] : [{ date: a.date, value: v }]
    })

  const W = 600
  const x0 = 55
  const x1 = 560
  const yTop = 25
  const yBottom = 145
  const min = Math.min(...puntos.map((p) => p.value))
  const max = Math.max(...puntos.map((p) => p.value))
  const span = max - min || Math.abs(max) || 1
  const coords = puntos.map((p, i) => ({
    ...p,
    x: puntos.length === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (puntos.length - 1),
    y: yBottom - ((p.value - min + span * 0.1) / (span * 1.2)) * (yBottom - yTop),
  }))
  const linea = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')

  return (
    <Card className="history-chart">
      <CardTitle title={parametro ? `Histórico de ${parametro}` : 'Histórico'} subtitle={`Evolución en los últimos ${puntos.length} análisis`}>
        {parametros.length > 0 && (
          <select aria-label="Parámetro" value={parametro} onChange={(e) => setElegido(e.target.value)} style={{ width: 'auto' }}>
            {parametros.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        )}
      </CardTitle>
      {puntos.length < 2 ? (
        <Empty title="Se necesitan al menos dos análisis">La gráfica muestra cómo cambia el parámetro entre análisis del mismo lote.</Empty>
      ) : (
        <svg viewBox={`0 0 ${W} 190`} role="img" aria-label={`Gráfica histórica de ${parametro}`}>
          <path d="M45 145H570M45 105H570M45 65H570M45 25H570" className="gridline" />
          <path d={`${linea} L${coords.at(-1)!.x} 165 L${coords[0].x} 165Z`} className="area" />
          <path d={linea} className="line" />
          <g className="points">
            {coords.map((c) => (
              <circle key={c.date} cx={c.x} cy={c.y} r="5">
                <title>
                  {formatDate(c.date)}: {formatNumber(c.value)}
                </title>
              </circle>
            ))}
          </g>
          <g className="labels">
            {coords.map((c) => (
              <text key={c.date} x={c.x - 22} y="185">
                {formatShortDate(c.date)} {new Date(c.date).getUTCFullYear()}
              </text>
            ))}
          </g>
        </svg>
      )}
    </Card>
  )
}

function Recomendaciones({ farmId, analisis, onSaved }: { farmId: string; analisis: SoilAnalysis | null; onSaved: () => void }) {
  const { role } = useAuth()
  const [agregando, setAgregando] = useState(false)
  const items = (analisis?.diagnostics ?? []).flatMap((d) => d.recommendations.map((r) => ({ d, r })))

  return (
    <Card className="recommendations">
      <div className="rec-title">
        <Icon name="leaf" />
        <div>
          <h2>Recomendaciones</h2>
          <p>Según los resultados del análisis seleccionado</p>
        </div>
      </div>
      {analisis && items.length === 0 && <Empty title="Sin recomendaciones">Los parámetros fuera de rango generan recomendaciones aquí.</Empty>}
      {items.map(({ d, r }) => {
        const estado = DIAGNOSIS_LABEL[d.status] ?? { label: d.status, tone: 'gray' as const }
        return (
          <div className="rec-item" key={r.id}>
            <Chip tone={estado.tone}>
              {d.parameter} {estado.label.toLowerCase()}
            </Chip>
            <h3>{r.type === 'BIOINSUMO' ? `Bioinsumo: ${r.bioinput?.name ?? 'sugerido'}` : 'Práctica sugerida'}</h3>
            <p>{r.description}</p>
            <div className="rec-meta">{r.automatic ? 'Generada automáticamente a partir del diagnóstico' : 'Registrada por el técnico'}</div>
            {r.bioinput && (
              <Link className="text-link" to="/bioinsumos" style={{ marginTop: 8 }}>
                Ver bioinsumo sugerido <Icon name="arrow" size={15} />
              </Link>
            )}
          </div>
        )
      })}
      {analisis && canDo(role, ROLES.registrarSuelo) && analisis.diagnostics.length > 0 && (
        <>
          {agregando ? (
            <RecomendacionForm
              farmId={farmId}
              diagnostics={analisis.diagnostics}
              onCancel={() => setAgregando(false)}
              onSaved={() => {
                setAgregando(false)
                onSaved()
              }}
            />
          ) : (
            <div style={{ paddingTop: 14 }}>
              <Button variant="secondary" icon="plus" onClick={() => setAgregando(true)}>
                Agregar recomendación
              </Button>
            </div>
          )}
        </>
      )}
      <small className="disclaimer">Estas recomendaciones deben ser validadas por el técnico responsable de la finca.</small>
    </Card>
  )
}

function RecomendacionForm({ farmId, diagnostics, onSaved, onCancel }: { farmId: string; diagnostics: Diagnosis[]; onSaved: () => void; onCancel: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const bioinsumos = useApiQuery<Bioinput[]>(`/farms/${farmId}/bioinputs`)
  // Primero los parámetros fuera de rango, que son los que suelen necesitar recomendación.
  const ordenados = [...diagnostics].sort((a, b) => Number(a.status === 'OPTIMO') - Number(b.status === 'OPTIMO'))
  const [diagnosisId, setDiagnosisId] = useState(ordenados[0]?.id ?? '')
  const [type, setType] = useState<'PRACTICA' | 'BIOINSUMO'>('PRACTICA')
  const [bioinputId, setBioinputId] = useState('')
  const [description, setDescription] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const ok = await mutate('/recommendations', 'POST', {
      diagnosisId,
      type,
      description: description.trim(),
      bioinputId: type === 'BIOINSUMO' ? bioinputId : undefined,
    })
    if (ok) onSaved()
  }

  return (
    <form className="rec-form" onSubmit={onSubmit}>
      <SelectField label="Parámetro *" value={diagnosisId} onChange={(e) => setDiagnosisId(e.target.value)}>
        {ordenados.map((d) => (
          <option key={d.id} value={d.id}>
            {d.parameter} · {(DIAGNOSIS_LABEL[d.status] ?? { label: d.status }).label}
          </option>
        ))}
      </SelectField>
      <SelectField label="Tipo *" value={type} onChange={(e) => setType(e.target.value as 'PRACTICA' | 'BIOINSUMO')}>
        <option value="PRACTICA">Práctica</option>
        <option value="BIOINSUMO">Bioinsumo</option>
      </SelectField>
      {type === 'BIOINSUMO' && (
        <SelectField label="Bioinsumo *" value={bioinputId} onChange={(e) => setBioinputId(e.target.value)} hint={bioinsumos.data?.length === 0 ? 'La finca no tiene bioinsumos registrados.' : undefined}>
          <option value="">Selecciona…</option>
          {(bioinsumos.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>
      )}
      <TextAreaField label="Descripción *" required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Incorporar 2–3 kg de compost por planta en la zona de plateo." />
      {error && <ErrorNotice message={error} />}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving || !description.trim() || !diagnosisId || (type === 'BIOINSUMO' && !bioinputId)}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}

type Fila = { key: number; name: string; value: string; unit: string }

const PARAMETROS_COMUNES: Omit<Fila, 'key' | 'value'>[] = [
  { name: 'pH', unit: '' },
  { name: 'Materia orgánica', unit: '%' },
  { name: 'Nitrógeno', unit: '%' },
  { name: 'Fósforo', unit: 'ppm' },
  { name: 'Potasio', unit: 'cmol/kg' },
  { name: 'Aluminio', unit: 'cmol/kg' },
]

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Registrar análisis de suelo (RF-10). El backend diagnostica cada parámetro contra el catálogo de rangos (RF-11). */
function AnalisisForm({
  farm,
  lots,
  defaultLot,
  onSaved,
  onCancel,
}: {
  farm: Farm
  lots: { id: string; name: string }[]
  defaultLot: string
  onSaved: (a: SoilAnalysis) => void
  onCancel: () => void
}) {
  const { mutate, saving, error } = useApiMutation()
  const [date, setDate] = useState(hoy())
  const [laboratory, setLaboratory] = useState('')
  const [lotId, setLotId] = useState(defaultLot)
  const [observations, setObservations] = useState('')
  const [filas, setFilas] = useState<Fila[]>(PARAMETROS_COMUNES.map((p, i) => ({ ...p, key: i, value: '' })))

  const completas = filas.filter((f) => f.name.trim() && parseOptionalNumber(f.value) !== undefined)
  const invalidas = filas.filter((f) => f.value.trim() && parseOptionalNumber(f.value) === undefined)

  function editar(key: number, cambio: Partial<Fila>) {
    setFilas((prev) => prev.map((f) => (f.key === key ? { ...f, ...cambio } : f)))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const creado = await mutate<SoilAnalysis>('/soil-analyses', 'POST', {
      farmId: farm.id,
      lotId: lotId || undefined,
      date,
      laboratory: optionalText(laboratory),
      observations: optionalText(observations),
      parameters: completas.map((f) => ({ name: f.name.trim(), value: parseOptionalNumber(f.value), unit: optionalText(f.unit) })),
    })
    if (creado) onSaved(creado)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Suelos y diagnósticos"
        title="Registrar análisis de suelo"
        subtitle="Ingresa los resultados entregados por el laboratorio. Los parámetros vacíos no se guardan."
        actions={
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        }
      />
      {lots.length === 0 && <div className="notice notice-warn">La finca no tiene lotes: el análisis quedará registrado para toda la finca.</div>}
      <Card className="form-card">
        <form onSubmit={onSubmit}>
          <div className="form-grid three">
            <TextField label="Fecha de análisis *" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            <TextField label="Laboratorio" value={laboratory} onChange={(e) => setLaboratory(e.target.value)} placeholder="Ej. Agrilab" />
            <SelectField label="Lote" value={lotId} onChange={(e) => setLotId(e.target.value)}>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
              <option value="">Toda la finca</option>
            </SelectField>
          </div>
          <h3>Parámetros físicos, químicos y biológicos</h3>
          <div className="parameter-entry">
            <strong>Parámetro</strong>
            <strong>Valor</strong>
            <strong>Unidad</strong>
            <strong />
            {filas.map((f) => (
              <Parametro key={f.key} fila={f} onChange={(c) => editar(f.key, c)} onRemove={() => setFilas((prev) => prev.filter((x) => x.key !== f.key))} />
            ))}
          </div>
          <div>
            <Button variant="ghost" icon="plus" onClick={() => setFilas((prev) => [...prev, { key: Date.now(), name: '', value: '', unit: '' }])}>
              Agregar parámetro
            </Button>
          </div>
          <TextAreaField label="Observaciones" value={observations} onChange={(e) => setObservations(e.target.value)} />
          {invalidas.length > 0 && <div className="notice notice-warn">Revisa los valores de: {invalidas.map((f) => f.name || 'sin nombre').join(', ')}. Deben ser números.</div>}
          {error && <ErrorNotice message={error} />}
          <div className="wizard-actions">
            <Button variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" icon="check" disabled={saving || completas.length === 0 || invalidas.length > 0}>
              {saving ? 'Guardando…' : 'Guardar análisis'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

function Parametro({ fila, onChange, onRemove }: { fila: Fila; onChange: (c: Partial<Fila>) => void; onRemove: () => void }) {
  return (
    <>
      <input className="param-name" aria-label="Parámetro" value={fila.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Nombre" />
      <input aria-label={`Valor de ${fila.name || 'parámetro'}`} inputMode="decimal" value={fila.value} onChange={(e) => onChange({ value: e.target.value })} placeholder="Ej. 5,4" />
      <input aria-label={`Unidad de ${fila.name || 'parámetro'}`} value={fila.unit} onChange={(e) => onChange({ unit: e.target.value })} placeholder="Unidad" />
      <button type="button" className="icon-button" onClick={onRemove} aria-label={`Quitar ${fila.name || 'parámetro'}`}>
        <Icon name="close" size={16} />
      </button>
    </>
  )
}
