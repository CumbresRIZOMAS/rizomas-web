import { useState, type FormEvent } from 'react'
import { useApiMutation } from '../../shared/api/hooks'
import type { AgronomicManagementType, Labor, LaborType, LotWithCrops } from '../../shared/api/types'
import { LABOR_TYPE_LABEL, MANAGEMENT_TYPE_LABEL, optionalText, parseOptionalNumber } from '../../shared/format'
import { ErrorNotice, FormCard, SelectField, TextAreaField, TextField } from '../../shared/ui'

type Clase = 'general' | 'manejo' | 'cosecha'
type Destino = 'lote' | 'cultivo'

const TIPOS_GENERALES: LaborType[] = ['SIEMBRA', 'APLICACION_BIOINSUMO', 'OTRO']

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Registrar una labor (RF-06). Regla xor del dominio: la labor cuelga de un
 * lote o de un cultivo, nunca de ambos ni de ninguno. Una cosecha siempre
 * cuelga de un cultivo.
 */
export function LaborForm({
  farmId,
  lots,
  defaultLotId,
  onSaved,
  onCancel,
}: {
  farmId: string
  lots: LotWithCrops[]
  defaultLotId?: string
  onSaved: (labor: Labor) => void
  onCancel: () => void
}) {
  const { mutate, saving, error } = useApiMutation()
  const cultivos = lots.flatMap((l) => l.crops.map((c) => ({ ...c, loteNombre: l.name })))

  const [clase, setClase] = useState<Clase>('general')
  const [destino, setDestino] = useState<Destino>('lote')
  const [lotId, setLotId] = useState(defaultLotId ?? lots[0]?.id ?? '')
  const [cropId, setCropId] = useState(cultivos.find((c) => c.lotId === defaultLotId)?.id ?? cultivos[0]?.id ?? '')
  const [type, setType] = useState<LaborType>('OTRO')
  const [managementType, setManagementType] = useState<AgronomicManagementType>('FERTILIZACION')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(hoy())
  const [endDate, setEndDate] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('kg')
  const [quality, setQuality] = useState('')
  const [observations, setObservations] = useState('')

  const destinoEfectivo: Destino = clase === 'cosecha' ? 'cultivo' : destino
  const sinDestino = destinoEfectivo === 'lote' ? !lotId : !cropId
  const sinCantidad = clase === 'cosecha' && parseOptionalNumber(quantity) === undefined
  const fechasInvalidas = endDate !== '' && endDate < startDate

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const base = {
      farmId,
      ...(destinoEfectivo === 'lote' ? { lotId } : { cropId }),
      name: name.trim(),
      startDate,
      endDate: endDate || undefined,
      observations: optionalText(observations),
    }
    let labor: Labor | null
    if (clase === 'cosecha') {
      labor = await mutate<Labor>('/harvests', 'POST', {
        ...base,
        type: 'COSECHA',
        quantity: parseOptionalNumber(quantity),
        unit: unit.trim(),
        quality: optionalText(quality),
      })
    } else if (clase === 'manejo') {
      labor = await mutate<Labor>('/agronomic-management', 'POST', {
        ...base,
        type: 'MANEJO_AGRONOMICO',
        managementType,
        quantity: parseOptionalNumber(quantity),
      })
    } else {
      labor = await mutate<Labor>('/labors', 'POST', { ...base, type })
    }
    if (labor) onSaved(labor)
  }

  if (lots.length === 0) {
    return (
      <FormCard title="Registrar labor">
        <div className="notice notice-warn">Primero agrega un lote a la finca: toda labor cuelga de un lote o de un cultivo.</div>
        <div className="form-actions" style={{ marginTop: 14 }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cerrar
          </button>
        </div>
      </FormCard>
    )
  }

  return (
    <FormCard title="Registrar labor">
      <form className="form" onSubmit={onSubmit}>
        <div className="field">
          <span>Clase de labor</span>
          <div className="segmented" role="group" aria-label="Clase de labor">
            {(
              [
                ['general', 'General'],
                ['manejo', 'Manejo agronómico'],
                ['cosecha', 'Cosecha'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={clase === id} onClick={() => setClase(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Se registra sobre</span>
          <div className="segmented" role="group" aria-label="Se registra sobre">
            <button type="button" aria-pressed={destinoEfectivo === 'lote'} disabled={clase === 'cosecha'} onClick={() => setDestino('lote')}>
              Un lote
            </button>
            <button type="button" aria-pressed={destinoEfectivo === 'cultivo'} onClick={() => setDestino('cultivo')}>
              Un cultivo
            </button>
          </div>
          {clase === 'cosecha' && <small className="hint">Una cosecha siempre se registra sobre un cultivo.</small>}
        </div>

        <div className="form-row">
          {destinoEfectivo === 'lote' ? (
            <SelectField label="Lote" value={lotId} onChange={(e) => setLotId(e.target.value)}>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </SelectField>
          ) : cultivos.length === 0 ? (
            <div className="notice notice-warn">Ningún lote de esta finca tiene cultivos registrados.</div>
          ) : (
            <SelectField label="Cultivo" value={cropId} onChange={(e) => setCropId(e.target.value)}>
              {cultivos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.loteNombre} — {[c.species, c.variety].filter(Boolean).join(' ')}
                </option>
              ))}
            </SelectField>
          )}

          {clase === 'general' && (
            <SelectField label="Tipo" value={type} onChange={(e) => setType(e.target.value as LaborType)}>
              {TIPOS_GENERALES.map((t) => (
                <option key={t} value={t}>
                  {LABOR_TYPE_LABEL[t]}
                </option>
              ))}
            </SelectField>
          )}
          {clase === 'manejo' && (
            <SelectField label="Tipo de manejo" value={managementType} onChange={(e) => setManagementType(e.target.value as AgronomicManagementType)}>
              {Object.entries(MANAGEMENT_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          )}
        </div>

        <div className="form-row">
          <TextField label="Descripción" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Fertilización con bocashi" />
          <TextField label="Fecha de inicio" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <TextField label="Fecha de fin" optional type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        {clase === 'cosecha' && (
          <div className="form-row">
            <TextField label="Cantidad" required inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <TextField label="Unidad" required value={unit} onChange={(e) => setUnit(e.target.value)} />
            <TextField label="Calidad" optional value={quality} onChange={(e) => setQuality(e.target.value)} />
          </div>
        )}
        {clase === 'manejo' && (
          <div className="form-row">
            <TextField label="Cantidad aplicada" optional inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
        )}

        <TextAreaField label="Observaciones" optional value={observations} onChange={(e) => setObservations(e.target.value)} />

        {fechasInvalidas && <div className="notice notice-warn">La fecha de fin no puede ser anterior a la de inicio.</div>}
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !name.trim() || sinDestino || sinCantidad || fechasInvalidas || (clase === 'cosecha' && !unit.trim())}
          >
            {saving ? 'Guardando…' : 'Registrar labor'}
          </button>
        </div>
      </form>
    </FormCard>
  )
}
