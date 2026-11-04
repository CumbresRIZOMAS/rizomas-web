import { useState, type FormEvent } from 'react'
import { useApiMutation } from '../../shared/api/hooks'
import type { Lot } from '../../shared/api/types'
import { optionalText, parseOptionalNumber } from '../../shared/format'
import { ErrorNotice, FormCard, TextField } from '../../shared/ui'

export function LoteForm({ farmId, lote: loteInicial, onSaved, onCancel }: { farmId: string; lote?: Lot; onSaved: (lote: Lot) => void; onCancel: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const [name, setName] = useState(loteInicial?.name ?? '')
  const [identifier, setIdentifier] = useState(loteInicial?.identifier ?? '')
  const [area, setArea] = useState(loteInicial?.areaHa?.toString() ?? '')
  const [latitude, setLatitude] = useState(loteInicial?.latitude?.toString() ?? '')
  const [longitude, setLongitude] = useState(loteInicial?.longitude?.toString() ?? '')
  const [locationJson, setLocationJson] = useState(loteInicial?.location ? JSON.stringify(loteInicial.location, null, 2) : '')
  const [locationError, setLocationError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    let location: Record<string, unknown> | undefined
    if (locationJson.trim()) {
      try {
        const parsed: unknown = JSON.parse(locationJson)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
        location = parsed as Record<string, unknown>
        setLocationError(null)
      } catch {
        setLocationError('La ubicación del lote debe ser un objeto GeoJSON válido.')
        return
      }
    }
    const body = {
      farmId,
      name: name.trim(),
      identifier: optionalText(identifier) ?? null,
      areaHa: parseOptionalNumber(area) ?? null,
      latitude: parseOptionalNumber(latitude) ?? null,
      longitude: parseOptionalNumber(longitude) ?? null,
      location: location ?? null,
    }
    const lote = loteInicial
      ? await mutate<Lot>(`/lots/${loteInicial.id}`, 'PATCH', body)
      : await mutate<Lot>('/lots', 'POST', body)
    if (lote) onSaved(lote)
  }

  return (
    <FormCard title={loteInicial ? 'Editar lote' : 'Nuevo lote'}>
      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <TextField label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: La Esperanza" />
          <TextField label="Identificador" optional value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          <TextField label="Área (ha)" optional inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value)} />
          <TextField label="Latitud" type="number" min="-90" max="90" step="any" optional inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
          <TextField label="Longitud" type="number" min="-180" max="180" step="any" optional inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
          <label className="field"><span>Geometría del lote (GeoJSON, opcional)</span><textarea rows={3} value={locationJson} onChange={(e) => setLocationJson(e.target.value)} placeholder='{"type":"Polygon","coordinates":[...]}' /><small>Para delimitar el lote en el mapa. Las coordenadas simples también se guardan por separado.</small></label>
        </div>
        {locationError && <p className="notice notice-error" role="alert">{locationError}</p>}
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
            {saving ? 'Guardando…' : loteInicial ? 'Guardar cambios' : 'Guardar lote'}
          </button>
        </div>
      </form>
    </FormCard>
  )
}
