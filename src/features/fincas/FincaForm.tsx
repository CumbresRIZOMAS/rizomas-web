import { useState, type FormEvent } from 'react'
import { useApiMutation } from '../../shared/api/hooks'
import type { Farm, FarmType } from '../../shared/api/types'
import divipola from '../../shared/data/colombia-divipola.json'
import { FARM_TYPE_LABEL, optionalText, parseOptionalNumber, toNumber } from '../../shared/format'
import { ErrorNotice, FormCard, SelectField, TextField } from '../../shared/ui'

const OTRO = '__otro__'
const DIVIPOLA = divipola as { dpto: string; nom_mpio: string }[]
const DEPARTAMENTOS = [...new Set(DIVIPOLA.map(({ dpto }) => dpto))].sort((a, b) => a.localeCompare(b, 'es'))
const normalizar = (valor: string) => valor.trim().toLocaleUpperCase('es-CO')

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
  const regionGuardada = finca?.region ?? ''
  const regionCatalogo = DEPARTAMENTOS.find((departamento) => normalizar(departamento) === normalizar(regionGuardada))
  const [region, setRegion] = useState(regionCatalogo ?? (regionGuardada ? OTRO : ''))
  const [otraRegion, setOtraRegion] = useState(regionCatalogo ? '' : regionGuardada)
  const municipios = DIVIPOLA.filter(({ dpto }) => dpto === region).map(({ nom_mpio }) => nom_mpio)
  const municipioGuardado = finca?.municipality ?? ''
  const municipioCatalogo = municipios.find((municipio) => normalizar(municipio) === normalizar(municipioGuardado))
  const [municipality, setMunicipality] = useState(municipioCatalogo ?? (municipioGuardado ? OTRO : ''))
  const [otroMunicipio, setOtroMunicipio] = useState(municipioCatalogo ? '' : municipioGuardado)
  const [area, setArea] = useState(toNumber(finca?.areaHa)?.toString() ?? '')
  const [climate, setClimate] = useState(finca?.climate ?? '')
  const [farmType, setFarmType] = useState<FarmType>(finca?.farmType ?? 'EN_TRANSICION')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const body = {
      name: name.trim(),
      identifier: optionalText(identifier),
      municipality: optionalText(region === OTRO || municipality === OTRO ? otroMunicipio : municipality),
      region: optionalText(region === OTRO ? otraRegion : region),
      areaHa: parseOptionalNumber(area),
      climate: optionalText(climate),
      farmType,
    }
    const saved = finca ? await mutate<Farm>(`/farms/${finca.id}`, 'PATCH', body) : await mutate<Farm>('/farms', 'POST', body)
    if (saved) onSaved(saved)
  }

  return (
    <FormCard title={title}>
      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <TextField label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: El Porvenir" />
          <TextField label="Identificador" optional value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        </div>
        <div className="form-grid">
          <SelectField label="Departamento" optional value={region} onChange={(e) => { setRegion(e.target.value); setMunicipality(''); setOtroMunicipio('') }}>
            <option value="">Selecciona un departamento</option>
            {DEPARTAMENTOS.map((departamento) => <option key={departamento} value={departamento}>{departamento}</option>)}
            <option value={OTRO}>Otro</option>
          </SelectField>
          {region === OTRO && <TextField label="Nombre del departamento" optional value={otraRegion} onChange={(e) => setOtraRegion(e.target.value)} placeholder="Escribe el departamento" />}
          {region !== OTRO ? (
            <SelectField label="Municipio" optional value={municipality} disabled={!region} onChange={(e) => setMunicipality(e.target.value)}>
              <option value="">{region ? 'Selecciona un municipio' : 'Primero selecciona un departamento'}</option>
              {municipios.map((municipio) => <option key={municipio} value={municipio}>{municipio}</option>)}
              <option value={OTRO}>Otro</option>
            </SelectField>
          ) : null}
          {(region === OTRO || municipality === OTRO) && <TextField label="Nombre del municipio" optional value={otroMunicipio} onChange={(e) => setOtroMunicipio(e.target.value)} placeholder="Escribe el municipio" />}
        </div>
        <div className="form-grid">
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
