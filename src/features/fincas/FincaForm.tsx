import { useState, type FormEvent } from 'react'
import { useApiMutation } from '../../shared/api/hooks'
import type { Farm, FarmType } from '../../shared/api/types'
import { FARM_TYPE_LABEL, optionalText, parseOptionalNumber, toNumber } from '../../shared/format'
import { ErrorNotice, FormCard, SelectField, TextField } from '../../shared/ui'

/** Crear finca (sin `finca`) o editar una existente (PATCH). */
export function FincaForm({
  title,
  finca,
  onSaved,
  onCancel,
}: {
  title: string
  finca?: Farm
  onSaved: (finca: Farm) => void
  onCancel: () => void
}) {
  const { mutate, saving, error } = useApiMutation()
  const [name, setName] = useState(finca?.name ?? '')
  const [identifier, setIdentifier] = useState(finca?.identifier ?? '')
  const [municipality, setMunicipality] = useState(finca?.municipality ?? '')
  const [region, setRegion] = useState(finca?.region ?? '')
  const [area, setArea] = useState(toNumber(finca?.areaHa)?.toString() ?? '')
  const [climate, setClimate] = useState(finca?.climate ?? '')
  const [farmType, setFarmType] = useState<FarmType>(finca?.farmType ?? 'EN_TRANSICION')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const body = {
      name: name.trim(),
      identifier: optionalText(identifier),
      municipality: optionalText(municipality),
      region: optionalText(region),
      areaHa: parseOptionalNumber(area),
      climate: optionalText(climate),
      farmType,
    }
    const saved = finca ? await mutate<Farm>(`/farms/${finca.id}`, 'PATCH', body) : await mutate<Farm>('/farms', 'POST', body)
    if (saved) onSaved(saved)
  }

  return (
    <FormCard title={title}>
      <form className="form" onSubmit={onSubmit}>
        <div className="form-row">
          <TextField label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: El Porvenir" />
          <TextField label="Identificador" optional value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        </div>
        <div className="form-row">
          <TextField label="Municipio" optional value={municipality} onChange={(e) => setMunicipality(e.target.value)} placeholder="Ej: Pitalito" />
          <TextField label="Departamento / región" optional value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Ej: Huila" />
        </div>
        <div className="form-row">
          <TextField label="Área (ha)" optional inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value)} />
          <TextField label="Clima" optional value={climate} onChange={(e) => setClimate(e.target.value)} placeholder="Ej: Templado húmedo" />
          <SelectField label="Tipo de finca" value={farmType} onChange={(e) => setFarmType(e.target.value as FarmType)}>
            {Object.entries(FARM_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </FormCard>
  )
}
