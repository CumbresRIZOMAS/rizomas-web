import { useState, type FormEvent } from 'react'
import { useApiMutation } from '../../shared/api/hooks'
import type { Lot } from '../../shared/api/types'
import { optionalText, parseOptionalNumber } from '../../shared/format'
import { ErrorNotice, FormCard, TextField } from '../../shared/ui'

export function LoteForm({ farmId, onSaved, onCancel }: { farmId: string; onSaved: (lote: Lot) => void; onCancel: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [area, setArea] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const lote = await mutate<Lot>('/lots', 'POST', {
      farmId,
      name: name.trim(),
      identifier: optionalText(identifier),
      areaHa: parseOptionalNumber(area),
      latitude: parseOptionalNumber(latitude),
      longitude: parseOptionalNumber(longitude),
    })
    if (lote) onSaved(lote)
  }

  return (
    <FormCard title="Nuevo lote">
      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <TextField label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: La Esperanza" />
          <TextField label="Identificador" optional value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          <TextField label="Área (ha)" optional inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value)} />
          <TextField label="Latitud" type="number" min="-90" max="90" step="any" optional inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
          <TextField label="Longitud" type="number" min="-180" max="180" step="any" optional inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
        </div>
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
            {saving ? 'Guardando…' : 'Guardar lote'}
          </button>
        </div>
      </form>
    </FormCard>
  )
}
