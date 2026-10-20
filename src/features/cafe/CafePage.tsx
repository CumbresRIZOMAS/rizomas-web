import { useState, type FormEvent } from 'react'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { CoffeeProcess, Farm, Labor, Lot, ProductFinal } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { RequireFarm } from '../../shared/farm/RequireFarm'
import { formatDate, formatNumber, formatShortDate, optionalText } from '../../shared/format'
import { Button, Card, CardTitle, Chip, EmptyState, ErrorNotice, FormCard, Icon, Loading, PageHeader, SelectField, TextAreaField, TextField } from '../../shared/ui'
import { codigoProceso, ETAPAS, etapaIndex } from './etapas'

export function CafePage() {
  return <RequireFarm>{(farm) => <Procesos key={farm.id} farm={farm} />}</RequireFarm>
}

function Procesos({ farm }: { farm: Farm }) {
  const { role } = useAuth()
  const procesos = useApiQuery<CoffeeProcess[]>(`/coffee-processes/farms/${farm.id}`)
  const labores = useApiQuery<Labor[]>(`/farms/${farm.id}/labors`)
  const lotes = useApiQuery<Lot[]>(`/farms/${farm.id}/lots`)
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const lista = procesos.data ?? []
  const actual = lista.find((p) => p.id === seleccion) ?? lista[0] ?? null
  const cosechas = (labores.data ?? []).filter((l) => l.type === 'COSECHA' && l.harvest?.id)
  const laborDeCosecha = (harvestId: string | null) => cosechas.find((l) => l.harvest?.id === harvestId)

  return (
    <div>
      <PageHeader
        eyebrow={actual ? `Lote de proceso ${codigoProceso(actual)}` : `Finca ${farm.name}`}
        title="Proceso de café"
        subtitle="Del despulpado y la fermentación hasta el café tostado y catado, con trazabilidad por lote."
        actions={
          canDo(role, ROLES.registrarEnFinca) &&
          !creando && (
            <Button icon="plus" onClick={() => setCreando(true)}>
              Nuevo proceso
            </Button>
          )
        }
      />
      <div className="stack">
        {creando && (
          <ProcesoForm
            farmId={farm.id}
            cosechas={cosechas}
            lotes={lotes.data ?? []}
            onCancel={() => setCreando(false)}
            onSaved={(p) => {
              setCreando(false)
              setSeleccion(p.id)
              procesos.reload()
            }}
          />
        )}
        {procesos.loading && !procesos.data && <Loading />}
        {procesos.error && <ErrorNotice message={procesos.error} onRetry={procesos.reload} />}
        {procesos.data && lista.length === 0 && !creando && (
          <EmptyState icon="process" title="Sin procesos de café">
            Registra el beneficio de una cosecha para seguir su transformación hasta el producto final.
          </EmptyState>
        )}
        {lista.length > 1 && (
          <div className="filter-tabs" role="tablist" aria-label="Procesos">
            {lista.map((p) => (
              <button key={p.id} type="button" role="tab" aria-selected={p.id === actual?.id} className={p.id === actual?.id ? 'active' : ''} onClick={() => setSeleccion(p.id)}>
                {codigoProceso(p)} · {formatShortDate(p.startedAt)}
              </button>
            ))}
          </div>
        )}
      </div>
      {actual && <Detalle key={actual.id} proceso={actual} origen={laborDeCosecha(actual.harvestId)} onChanged={procesos.reload} />}
    </div>
  )
}

function Detalle({ proceso, origen, onChanged }: { proceso: CoffeeProcess; origen?: Labor; onChanged: () => void }) {
  const { role } = useAuth()
  const puedeEditar = canDo(role, ROLES.registrarEnFinca)
  const puedeCertificar = canDo(role, ROLES.certificar)
  const { mutate, saving, error } = useApiMutation()
  const [editandoNotas, setEditandoNotas] = useState(false)
  const [notas, setNotas] = useState(proceso.notes ?? '')
  const [agregandoProducto, setAgregandoProducto] = useState(false)
  const [agregandoEtapa, setAgregandoEtapa] = useState(false)
  const indice = proceso.finishedAt ? ETAPAS.length : etapaIndex(proceso)
  const siguiente = !proceso.finishedAt && indice >= 0 ? ETAPAS[indice + 1] : undefined

  async function actualizar(cambio: { currentStage?: string; finishedAt?: string | null; notes?: string }) {
    if (await mutate(`/coffee-processes/${proceso.id}`, 'PATCH', cambio)) {
      setEditandoNotas(false)
      onChanged()
    }
  }

  return (
    <>
      <div className="process-summary">
        <div>
          <Icon name="coffee" size={30} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Origen</span>
            <strong>{origen ? (origen.lot?.name ?? origen.name) : 'Sin cosecha asociada'}</strong>
          </div>
        </div>
        <div>
          <span>Cosecha inicial</span>
          <strong>{proceso.harvest ? `${formatNumber(proceso.harvest.quantity)} ${proceso.harvest.unit}` : '—'}</strong>
        </div>
        <div>
          <span>Estado actual</span>
          <Chip tone={proceso.finishedAt ? 'green' : 'amber'}>{proceso.finishedAt ? 'Finalizado' : proceso.currentStage}</Chip>
        </div>
        <div>
          <span>{proceso.finishedAt ? 'Finalizado' : 'Inicio'}</span>
          <strong>{formatDate(proceso.finishedAt ?? proceso.startedAt)}</strong>
        </div>
      </div>
      <div className="pipeline">
        {ETAPAS.map((etapa, i) => {
          const estado = i < indice ? 'complete' : i === indice ? 'current' : ''
          return (
            <div className={`stage ${estado}`} key={etapa.nombre}>
              <div className="stage-number">{i < indice ? <Icon name="check" size={16} /> : i + 1}</div>
              <div className="stage-card">
                <div className="stage-icon">
                  <Icon name={etapa.icon} />
                </div>
                <h3>{etapa.nombre}</h3>
                <span>{estado === 'complete' ? 'Completada' : estado === 'current' ? 'En proceso' : 'Pendiente'}</span>
                {i === 0 && proceso.harvest && (
                  <strong>
                    {formatNumber(proceso.harvest.quantity)} {proceso.harvest.unit}
                  </strong>
                )}
              </div>
              {i < ETAPAS.length - 1 && <Icon name="arrow" />}
            </div>
          )
        })}
      </div>
      {indice === -1 && <div className="notice notice-warn">La etapa registrada (“{proceso.currentStage}”) no coincide con las etapas estándar del proceso.</div>}
      <div className="stack">
        <Card className="card-pad">
          <CardTitle title="Cadena de poscosecha" subtitle="Mediciones por etapa, incluido el destino del agua del lavado">
            {puedeEditar && !agregandoEtapa && <Button variant="secondary" icon="plus" onClick={() => setAgregandoEtapa(true)}>Registrar etapa</Button>}
          </CardTitle>
          {agregandoEtapa && <EtapaForm processId={proceso.id} onCancel={() => setAgregandoEtapa(false)} onSaved={() => { setAgregandoEtapa(false); onChanged() }} />}
          {(proceso.events ?? []).map((e) => <div className="application-row" key={e.id}><div className="date-box">{formatShortDate(e.recordedAt)}</div><div><strong>{e.stage}</strong><div>{e.inputKg ?? '—'} kg entran → {e.outputKg ?? '—'} kg salen</div>{e.stage === 'Lavado' && <div>Agua limpia {e.waterLiters ?? '—'} L · Agua residual con mucílago {e.wastewaterLiters ?? '—'} L · {e.compostReuse ? 'Reutilizada para compostaje' : 'Destino no indicado'}</div>}{e.durationHours != null && <div>{e.durationHours} h</div>}{e.method && <div>{e.method}</div>}{e.brix != null && <div>{e.brix} °Brix</div>}{e.ph != null && <div>pH {e.ph}</div>}{e.moisturePercent != null && <div>Humedad {e.moisturePercent}%</div>}{e.scaScore != null && <div>Puntaje SCA {e.scaScore}</div>}{e.notes && <small>{e.notes}</small>}</div></div>)}
          {!proceso.events?.length && !agregandoEtapa && <p className="muted">Aún no se han registrado etapas con mediciones.</p>}
        </Card>
        {error && <ErrorNotice message={error} />}
        <Card className="process-note">
          <Icon name="sync" />
          <div>
            <strong>{proceso.finishedAt ? 'Proceso finalizado' : `${proceso.currentStage} en curso`}</strong>
            {editandoNotas ? (
              <form
                className="rec-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void actualizar({ notes: notas.trim() })
                }}
              >
                <TextAreaField label="Notas del proceso" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. Humedad actual 18,2 %, objetivo 10–12 %" />
                <div className="form-actions">
                  <Button variant="ghost" onClick={() => setEditandoNotas(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    Guardar notas
                  </Button>
                </div>
              </form>
            ) : (
              <span>{proceso.notes ?? 'Sin notas registradas.'}</span>
            )}
          </div>
          {puedeEditar && !editandoNotas && (
            <div className="note-actions">
              <Button variant="secondary" onClick={() => setEditandoNotas(true)}>
                Actualizar notas
              </Button>
              {siguiente && (
                <Button disabled={saving} onClick={() => void actualizar({ currentStage: siguiente.nombre })}>
                  Pasar a {siguiente.nombre.toLowerCase()} <Icon name="arrow" size={16} />
                </Button>
              )}
              {!proceso.finishedAt && !siguiente && indice >= 0 && (
                <Button icon="check" disabled={saving} onClick={() => void actualizar({ finishedAt: new Date().toISOString() })}>
                  Finalizar proceso
                </Button>
              )}
              {proceso.finishedAt && (
                <Button variant="ghost" disabled={saving} onClick={() => void actualizar({ finishedAt: null })}>
                  Reabrir
                </Button>
              )}
            </div>
          )}
        </Card>
        <Card className="card-pad">
          <CardTitle title="Producto final" subtitle="Resultado del proceso y sus certificaciones">
            {puedeEditar && !agregandoProducto && (
              <Button variant="secondary" icon="plus" onClick={() => setAgregandoProducto(true)}>
                Registrar producto
              </Button>
            )}
          </CardTitle>
          {agregandoProducto && (
            <ProductoForm
              processId={proceso.id}
              onCancel={() => setAgregandoProducto(false)}
              onSaved={() => {
                setAgregandoProducto(false)
                onChanged()
              }}
            />
          )}
          {proceso.products.length === 0 && !agregandoProducto && (
            <p className="muted" style={{ fontSize: 9 }}>
              Este proceso todavía no tiene producto final registrado.
            </p>
          )}
          {proceso.products.map((p) => (
            <Producto key={p.id} producto={p} puedeCertificar={puedeCertificar} onChanged={onChanged} />
          ))}
        </Card>
      </div>
    </>
  )
}

const ESTADOS_CERTIFICACION = ['EN_TRAMITE', 'VIGENTE', 'VENCIDA'] as const
const ESTADO_CERTIFICACION_LABEL: Record<string, { label: string; tone: 'amber' | 'green' | 'gray' }> = {
  EN_TRAMITE: { label: 'En trámite', tone: 'amber' },
  VIGENTE: { label: 'Vigente', tone: 'green' },
  VENCIDA: { label: 'Vencida', tone: 'gray' },
}

function EtapaForm({ processId, onSaved, onCancel }: { processId: string; onSaved: () => void; onCancel: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const [stage, setStage] = useState('Despulpado')
  const [date, setDate] = useState(hoy())
  const [input, setInput] = useState(''); const [output, setOutput] = useState(''); const [water, setWater] = useState(''); const [waste, setWaste] = useState('')
  const [compost, setCompost] = useState(false); const [hours, setHours] = useState(''); const [method, setMethod] = useState(''); const [notes, setNotes] = useState('')
  const [brix, setBrix] = useState(''); const [ph, setPh] = useState(''); const [moisture, setMoisture] = useState(''); const [sca, setSca] = useState('')
  const numeric = (v: string) => v.trim() ? Number(v) : undefined
  async function submit(e: FormEvent) { e.preventDefault(); if (await mutate(`/coffee-processes/${processId}/events`, 'POST', { stage, recordedAt: date, inputKg: numeric(input), outputKg: numeric(output), waterLiters: numeric(water), wastewaterLiters: numeric(waste), compostReuse: compost, durationHours: numeric(hours), method: optionalText(method), brix: numeric(brix), ph: numeric(ph), moisturePercent: numeric(moisture), scaScore: numeric(sca), notes: optionalText(notes) })) onSaved() }
  return <form className="rec-form" onSubmit={submit}><div className="form-grid three"><SelectField label="Etapa" value={stage} onChange={(e) => setStage(e.target.value)}>{['Cosecha','Despulpado','Fermentación','Lavado','Secado','Trilla','Tostión','Catación'].map((x) => <option key={x}>{x}</option>)}</SelectField><TextField label="Fecha" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /><TextField label="Duración (horas)" type="number" min="0" step="any" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
    <div className="form-grid three"><TextField label="Cantidad que entra (kg)" type="number" min="0" step="any" value={input} onChange={(e) => setInput(e.target.value)} /><TextField label="Cantidad que sale (kg)" type="number" min="0" step="any" value={output} onChange={(e) => setOutput(e.target.value)} /><TextField label="Método" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Ej. fermentación láctica" /></div>
    {stage === 'Lavado' && <><div className="form-grid two"><TextField label="Agua limpia utilizada (L)" type="number" min="0" step="any" value={water} onChange={(e) => setWater(e.target.value)} /><TextField label="Agua residual con mucílago (L)" type="number" min="0" step="any" value={waste} onChange={(e) => setWaste(e.target.value)} /></div><label><input type="checkbox" checked={compost} onChange={(e) => setCompost(e.target.checked)} /> Reutilizar agua residual para compostaje</label></>}
    <div className="form-grid three"><TextField label="°Brix" type="number" min="0" step="any" value={brix} onChange={(e) => setBrix(e.target.value)} /><TextField label="pH" type="number" min="0" step="any" value={ph} onChange={(e) => setPh(e.target.value)} /><TextField label="Humedad final (%)" type="number" min="0" step="any" value={moisture} onChange={(e) => setMoisture(e.target.value)} /><TextField label="Puntaje SCA" type="number" min="0" step="any" value={sca} onChange={(e) => setSca(e.target.value)} /></div><TextAreaField label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />{error && <ErrorNotice message={error} />}<div className="form-actions"><Button variant="ghost" onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={saving}>Guardar etapa</Button></div></form>
}

function Producto({ producto, puedeCertificar, onChanged }: { producto: ProductFinal; puedeCertificar: boolean; onChanged: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const [certificando, setCertificando] = useState(false)
  const [certifier, setCertifier] = useState('')
  const [status, setStatus] = useState<string>('EN_TRAMITE')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (await mutate(`/coffee-processes/products/${producto.id}/certifications`, 'POST', { certifier: certifier.trim(), status })) {
      setCertificando(false)
      setCertifier('')
      onChanged()
    }
  }

  return (
    <div className="application-row" style={{ alignItems: 'start' }}>
      <div className="date-box">{formatShortDate(producto.finalizedAt)}</div>
      <div>
        <strong>{producto.destination ?? 'Producto final'}</strong>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {(producto.certifications ?? []).length === 0 && <span>Sin certificaciones</span>}
          {(producto.certifications ?? []).map((c) => {
            const estado = ESTADO_CERTIFICACION_LABEL[c.status] ?? { label: c.status, tone: 'gray' as const }
            return (
              <Chip key={c.id} tone={estado.tone}>
                {c.certifier} · {estado.label}
              </Chip>
            )
          })}
        </div>
        {certificando && (
          <form className="rec-form" onSubmit={onSubmit}>
            <div className="form-grid">
              <TextField label="Certificadora *" required value={certifier} onChange={(e) => setCertifier(e.target.value)} placeholder="Ej. Rainforest Alliance" />
              <SelectField label="Estado *" value={status} onChange={(e) => setStatus(e.target.value)}>
                {ESTADOS_CERTIFICACION.map((s) => (
                  <option key={s} value={s}>
                    {ESTADO_CERTIFICACION_LABEL[s].label}
                  </option>
                ))}
              </SelectField>
            </div>
            {error && <ErrorNotice message={error} />}
            <div className="form-actions">
              <Button variant="ghost" onClick={() => setCertificando(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !certifier.trim()}>
                Guardar certificación
              </Button>
            </div>
          </form>
        )}
      </div>
      {puedeCertificar && !certificando && (
        <Button variant="ghost" icon="plus" onClick={() => setCertificando(true)}>
          Certificación
        </Button>
      )}
    </div>
  )
}

function ProductoForm({ processId, onSaved, onCancel }: { processId: string; onSaved: () => void; onCancel: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const [destination, setDestination] = useState('')
  const [finalizedAt, setFinalizedAt] = useState(hoy())

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (await mutate(`/coffee-processes/${processId}/products`, 'POST', { destination: optionalText(destination), finalizedAt })) onSaved()
  }

  return (
    <form className="rec-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <TextField label="Producto o destino *" required value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Ej. Café tostado 340 g · tienda" />
        <TextField label="Fecha de finalización *" type="date" required value={finalizedAt} onChange={(e) => setFinalizedAt(e.target.value)} />
      </div>
      {error && <ErrorNotice message={error} />}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" icon="check" disabled={saving || !destination.trim()}>
          Guardar producto
        </Button>
      </div>
    </form>
  )
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

function ProcesoForm({ farmId, cosechas, lotes, onSaved, onCancel }: { farmId: string; cosechas: Labor[]; lotes: Lot[]; onSaved: (p: CoffeeProcess) => void; onCancel: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const [harvestId, setHarvestId] = useState(cosechas[0]?.harvest?.id ?? '')
  const [lotId, setLotId] = useState(cosechas[0] ? (cosechas[0].lotId ?? cosechas[0].crop?.lotId ?? '') : lotes[0]?.id ?? '')
  const [currentStage, setCurrentStage] = useState('Cosecha')
  const [startedAt, setStartedAt] = useState(hoy())
  const [notes, setNotes] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const creado = await mutate<CoffeeProcess>('/coffee-processes', 'POST', {
      farmId,
      harvestId: harvestId || undefined,
      lotId: harvestId ? (cosechas.find((c) => c.harvest?.id === harvestId)?.lotId ?? cosechas.find((c) => c.harvest?.id === harvestId)?.crop?.lotId) : lotId || undefined,
      currentStage,
      startedAt,
      notes: optionalText(notes),
    })
    if (creado) onSaved(creado)
  }

  return (
    <FormCard title="Nuevo proceso de café">
      <form onSubmit={onSubmit}>
        <div className="form-grid three">
          <SelectField label="Cosecha de origen" value={harvestId} onChange={(e) => { const id = e.target.value; setHarvestId(id); const labor = cosechas.find((c) => c.harvest?.id === id); if (labor) setLotId(labor.lotId ?? labor.crop?.lotId ?? '') }}>
            <option value="">Sin cosecha asociada</option>
            {cosechas.map((l) => (
              <option key={l.id} value={l.harvest!.id}>
                {formatShortDate(l.startDate)} · {l.name} · {formatNumber(l.harvest!.quantity)} {l.harvest!.unit}
              </option>
            ))}
          </SelectField>
          <SelectField label="Lote asociado *" value={lotId} onChange={(e) => setLotId(e.target.value)}>
            {lotes.map((lot) => <option key={lot.id} value={lot.id}>{lot.name}</option>)}
          </SelectField>
          <SelectField label="Etapa actual *" value={currentStage} onChange={(e) => setCurrentStage(e.target.value)}>
            {ETAPAS.map((e) => (
              <option key={e.nombre}>{e.nombre}</option>
            ))}
          </SelectField>
          <TextField label="Fecha de inicio *" type="date" required value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
        </div>
        <TextAreaField label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. Humedad actual 18,2 %, objetivo 10–12 %" />
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" icon="check" disabled={saving || !lotId}>
            {saving ? 'Guardando…' : 'Guardar proceso'}
          </Button>
        </div>
      </form>
    </FormCard>
  )
}
