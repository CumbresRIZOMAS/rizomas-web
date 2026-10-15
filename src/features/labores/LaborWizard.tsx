import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { uploadEvidence } from '../../shared/api/evidence'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { AgronomicManagementType, Farm, FarmDetail, Labor } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { RequireFarm } from '../../shared/farm/RequireFarm'
import { formatHa, MANAGEMENT_TYPE_LABEL, optionalText, parseOptionalNumber } from '../../shared/format'
import { Button, Card, Chip, ErrorNotice, Icon, Loading, PageHeader, SelectField, TextAreaField, TextField, type IconName } from '../../shared/ui'
import { MovimientoForm } from '../comercial/ComercialPanel'

type Tipo = 'siembra' | 'cosecha' | 'manejo' | 'compra' | 'venta'

const TIPOS: { id: Tipo; nombre: string; descripcion: string; icon: IconName }[] = [
  { id: 'siembra', nombre: 'Siembra', descripcion: 'Establecimiento de un cultivo', icon: 'leaf' },
  { id: 'cosecha', nombre: 'Cosecha', descripcion: 'Recolección de café u otro producto', icon: 'coffee' },
  { id: 'manejo', nombre: 'Manejo agronómico', descripcion: 'Limpieza, poda, abono o revisión', icon: 'tool' },
  { id: 'compra', nombre: 'Compra', descripcion: 'Insumos, materiales o servicios', icon: 'wallet' },
  { id: 'venta', nombre: 'Venta', descripcion: 'Productos cosechados o procesados', icon: 'report' },
]

const PASOS = ['Tipo de labor', 'Ubicación', 'Detalles']

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

export function LaborWizard() {
  return <RequireFarm>{(farm) => <Wizard key={farm.id} farm={farm} />}</RequireFarm>
}

/**
 * Registrar labor (RF-06) en tres pasos. Regla xor del dominio: la labor
 * cuelga de un cultivo o directamente del lote, nunca de ambos. Una cosecha
 * siempre cuelga de un cultivo. Compra y venta son transacciones de la finca.
 */
function Wizard({ farm }: { farm: Farm }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { role, token } = useAuth()
  const detalle = useApiQuery<FarmDetail>(`/farms/${farm.id}`)
  const { mutate, saving, error } = useApiMutation()
  const verComercial = canDo(role, ROLES.verComercial)
  const inicial = TIPOS.find((t) => t.id === params.get('tipo'))?.id ?? 'manejo'

  const [paso, setPaso] = useState(1)
  const [tipo, setTipo] = useState<Tipo>(inicial)
  const [lotId, setLotId] = useState('')
  const [cropId, setCropId] = useState('')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(hoy())
  const [endDate, setEndDate] = useState('')
  const [horas, setHoras] = useState('')
  const [managementType, setManagementType] = useState<AgronomicManagementType>('PODA')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('kg')
  const [quality, setQuality] = useState('')
  const [observations, setObservations] = useState('')
  const [fotos, setFotos] = useState<File[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [guardada, setGuardada] = useState<{ nombre: string; lugar: string; fotosFallidas: number } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  if (detalle.loading && !detalle.data) return <Loading />
  if (detalle.error) return <ErrorNotice message={detalle.error} onRetry={detalle.reload} />
  const lots = detalle.data?.lots ?? []
  const lote = lots.find((l) => l.id === lotId) ?? lots[0]
  const cultivos = lote?.crops ?? []
  const cultivo = cultivos.find((c) => c.id === cropId)
  const esTransaccion = tipo === 'compra' || tipo === 'venta'

  function reiniciar() {
    setGuardada(null)
    setPaso(1)
    setName('')
    setQuantity('')
    setQuality('')
    setObservations('')
    setHoras('')
    setEndDate('')
    setFotos([])
  }

  if (guardada)
    return (
      <Card className="success-state">
        <div className="success-mark">
          <Icon name="check" size={34} />
        </div>
        <h2>Labor guardada correctamente</h2>
        <p>
          La labor “{guardada.nombre}” quedó registrada en {guardada.lugar}.
          {guardada.fotosFallidas > 0 && ` ${guardada.fotosFallidas} foto(s) no se pudieron subir; puedes intentarlo de nuevo desde la app.`}
        </p>
        <div>
          <Button variant="secondary" onClick={reiniciar}>
            Registrar otra
          </Button>
          <Button onClick={() => navigate('/labores')}>Ver en el historial</Button>
        </div>
      </Card>
    )

  const sinCultivoParaCosecha = tipo === 'cosecha' && !cultivo
  const fechasInvalidas = endDate !== '' && endDate < startDate
  const sinCantidad = tipo === 'cosecha' && (parseOptionalNumber(quantity) === undefined || !unit.trim())
  const puedeGuardar = !saving && !subiendo && name.trim() !== '' && !fechasInvalidas && !sinCantidad && !sinCultivoParaCosecha

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!lote || !puedeGuardar) return
    const minutos = parseOptionalNumber(horas)
    const base = {
      farmId: farm.id,
      ...(cultivo ? { cropId: cultivo.id } : { lotId: lote.id }),
      name: name.trim(),
      startDate,
      endDate: endDate || undefined,
      durationMin: minutos === undefined ? undefined : Math.round(minutos * 60),
      observations: optionalText(observations),
    }
    let labor: Labor | null
    if (tipo === 'cosecha') {
      labor = await mutate<Labor>('/harvests', 'POST', { ...base, type: 'COSECHA', quantity: parseOptionalNumber(quantity), unit: unit.trim(), quality: optionalText(quality) })
    } else if (tipo === 'manejo') {
      labor = await mutate<Labor>('/agronomic-management', 'POST', { ...base, type: 'MANEJO_AGRONOMICO', managementType, quantity: parseOptionalNumber(quantity) })
    } else {
      labor = await mutate<Labor>('/labors', 'POST', { ...base, type: 'SIEMBRA' })
    }
    if (!labor) return

    let fallidas = 0
    if (fotos.length) {
      setSubiendo(true)
      for (const foto of fotos) {
        try {
          await uploadEvidence(token ?? undefined, foto, { farmId: farm.id, lotId: lote.id, laborId: labor.id })
        } catch {
          fallidas += 1
        }
      }
      setSubiendo(false)
    }
    setGuardada({ nombre: labor.name, lugar: lote.name, fotosFallidas: fallidas })
  }

  return (
    <div>
      <PageHeader eyebrow="Labores / Nueva labor" title="Registrar labor" subtitle="Completa los datos paso a paso. Podrás revisar todo antes de guardar." />
      <div className="stepper">
        {PASOS.map((label, i) => (
          <div className={`${paso === i + 1 ? 'active' : ''} ${paso > i + 1 ? 'done' : ''}`} key={label}>
            <span>{paso > i + 1 ? <Icon name="check" size={15} /> : i + 1}</span>
            <strong>{label}</strong>
          </div>
        ))}
      </div>

      {paso === 3 && esTransaccion ? (
        <div className="wizard-card" style={{ padding: 0 }}>
          <MovimientoForm farmId={farm.id} tipoInicial={tipo as 'compra' | 'venta'} onCancel={() => setPaso(1)} onSaved={() => navigate('/comercial')} />
        </div>
      ) : (
        <Card className="wizard-card">
          <form onSubmit={guardar}>
            {paso === 1 && (
              <>
                <div className="section-heading">
                  <h2>¿Qué labor vas a registrar?</h2>
                  <p>Selecciona la opción que mejor describa la actividad.</p>
                </div>
                <div className="type-grid" role="radiogroup" aria-label="Tipo de labor">
                  {TIPOS.map((t) => {
                    const bloqueada = (t.id === 'compra' || t.id === 'venta') && !verComercial
                    return (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={tipo === t.id}
                        className={`type-card ${tipo === t.id ? 'selected' : ''}`}
                        onClick={() => setTipo(t.id)}
                        disabled={bloqueada}
                        title={bloqueada ? 'Solo administradores registran compras y ventas' : undefined}
                        key={t.id}
                      >
                        <span>
                          <Icon name={t.icon} size={27} />
                        </span>
                        <strong>{t.nombre}</strong>
                        <small>{t.descripcion}</small>
                        {tipo === t.id && (
                          <i>
                            <Icon name="check" size={14} />
                          </i>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {paso === 2 && esTransaccion && (
              <>
                <div className="section-heading">
                  <h2>¿A qué finca corresponde?</h2>
                  <p>Las compras y ventas son transacciones de la finca: no se asocian a un lote ni a un cultivo.</p>
                </div>
                <div className="info-note">
                  <Icon name="location" />
                  <div>
                    <strong>Finca {farm.name}</strong>
                    <span>{[farm.municipality, farm.region].filter(Boolean).join(' · ') || 'Sin ubicación registrada'}</span>
                  </div>
                </div>
              </>
            )}

            {paso === 2 && !esTransaccion && (
              <>
                <div className="section-heading">
                  <h2>¿Dónde se realizó?</h2>
                  <p>
                    {tipo === 'cosecha'
                      ? 'Una cosecha siempre se registra sobre un cultivo del lote.'
                      : 'El cultivo es opcional. Puedes registrar una labor solo en el lote, por ejemplo una limpieza antes de sembrar.'}
                  </p>
                </div>
                {lots.length === 0 ? (
                  <div className="notice notice-warn">Primero agrega un lote a la finca: toda labor cuelga de un lote o de un cultivo.</div>
                ) : (
                  <div className="form-grid">
                    <SelectField
                      label="Lote *"
                      value={lote?.id ?? ''}
                      onChange={(e) => {
                        setLotId(e.target.value)
                        setCropId('')
                      }}
                    >
                      {lots.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} · {formatHa(l.areaHa)}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField label={tipo === 'cosecha' ? 'Cultivo *' : 'Cultivo (opcional)'} value={cultivo?.id ?? ''} onChange={(e) => setCropId(e.target.value)}>
                      <option value="">{tipo === 'cosecha' ? 'Selecciona un cultivo' : 'Sin cultivo específico'}</option>
                      {cultivos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {[c.species, c.variety].filter(Boolean).join(' ')}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                )}
                {tipo === 'cosecha' && lote && cultivos.length === 0 && (
                  <div className="notice notice-warn" style={{ marginTop: 14 }}>
                    El lote {lote.name} no tiene cultivos. Agrégalo desde el detalle del lote para registrar la cosecha.
                  </div>
                )}
                <div className="info-note">
                  <Icon name="location" />
                  <div>
                    <strong>Finca {farm.name}</strong>
                    <span>{[farm.municipality, farm.region].filter(Boolean).join(' · ') || 'Sin ubicación registrada'}</span>
                  </div>
                </div>
              </>
            )}

            {paso === 3 && !esTransaccion && (
              <>
                <div className="section-heading">
                  <h2>Detalles de {TIPOS.find((t) => t.id === tipo)!.nombre.toLowerCase()}</h2>
                  <p>Los campos marcados con * son necesarios para guardar.</p>
                </div>
                <div className="form-grid three">
                  <TextField label="Descripción *" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Poda de formación" />
                  <TextField label="Fecha de inicio *" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  <TextField label="Fecha de finalización" type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  <TextField label="Duración (horas)" inputMode="decimal" placeholder="Ej. 6" value={horas} onChange={(e) => setHoras(e.target.value)} />
                  {tipo === 'manejo' && (
                    <>
                      <SelectField label="Actividad *" value={managementType} onChange={(e) => setManagementType(e.target.value as AgronomicManagementType)}>
                        {Object.entries(MANAGEMENT_TYPE_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </SelectField>
                      <TextField label="Cantidad" inputMode="decimal" placeholder="Ej. 250" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                    </>
                  )}
                  {tipo === 'cosecha' && (
                    <>
                      <TextField label="Cantidad *" required inputMode="decimal" placeholder="Ej. 680" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                      <TextField label="Unidad *" required value={unit} onChange={(e) => setUnit(e.target.value)} />
                      <TextField label="Calidad" value={quality} onChange={(e) => setQuality(e.target.value)} placeholder="Ej. Recolección selectiva" />
                    </>
                  )}
                </div>
                <TextAreaField
                  label="Observaciones"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Agrega detalles útiles para el seguimiento de esta labor..."
                />
                <div className="upload-zone">
                  <Icon name="upload" size={28} />
                  <div>
                    <strong>Agrega fotos de evidencia</strong>
                    <span>Selecciónalas desde tu equipo · JPG o PNG. Quedan pendientes de moderación antes de publicarse.</span>
                    {fotos.length > 0 && (
                      <div className="upload-list">
                        {fotos.map((f) => (
                          <Chip key={f.name + f.lastModified} tone="gray">
                            {f.name}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png"
                    multiple
                    aria-label="Fotos de evidencia"
                    onChange={(e) => setFotos([...(e.target.files ?? [])])}
                  />
                  <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                    Seleccionar fotos
                  </Button>
                </div>
                {fechasInvalidas && (
                  <div className="notice notice-warn" style={{ marginTop: 14 }}>
                    La fecha de finalización no puede ser anterior a la de inicio.
                  </div>
                )}
                {error && (
                  <div style={{ marginTop: 14 }}>
                    <ErrorNotice message={error} />
                  </div>
                )}
              </>
            )}

            <div className="wizard-actions">
              <Button variant="ghost" onClick={() => (paso === 1 ? navigate('/labores') : setPaso(paso - 1))}>
                {paso === 1 ? 'Cancelar' : 'Atrás'}
              </Button>
              {paso < 3 ? (
                <Button
                  onClick={() => setPaso(paso + 1)}
                  disabled={paso === 2 && !esTransaccion && (lots.length === 0 || sinCultivoParaCosecha)}
                >
                  Continuar <Icon name="arrow" size={17} />
                </Button>
              ) : (
                <Button type="submit" disabled={!puedeGuardar}>
                  {saving ? 'Guardando…' : subiendo ? 'Subiendo fotos…' : 'Guardar labor'} <Icon name="check" size={17} />
                </Button>
              )}
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
