import { useState, type FormEvent } from 'react'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { AppUser, Farm, FarmType } from '../../shared/api/types'
import { useAuth } from '../../shared/auth/context'
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
  const { role } = useAuth()
  const usuarios = useApiQuery<AppUser[]>(role === 'ADMIN_CUMBRES' ? '/users' : null)
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
  const [vereda, setVereda] = useState(finca?.village ?? '')
  const [latitude, setLatitude] = useState(toNumber(finca?.latitude)?.toString() ?? '')
  const [longitude, setLongitude] = useState(toNumber(finca?.longitude)?.toString() ?? '')
  const publicLocation = finca?.publicLocation as { latitude?: number; longitude?: number } | null | undefined
  const [publicLatitude, setPublicLatitude] = useState(publicLocation?.latitude?.toString() ?? '')
  const [publicLongitude, setPublicLongitude] = useState(publicLocation?.longitude?.toString() ?? '')
  const [locationVisibility, setLocationVisibility] = useState<Farm['locationVisibility']>(finca?.locationVisibility ?? 'PRIVADA')
  const [ownerId, setOwnerId] = useState(finca?.owner?.id ?? '')
  const [exactLocationJson, setExactLocationJson] = useState(finca?.exactLocation ? JSON.stringify(finca.exactLocation, null, 2) : '')
  const [locationError, setLocationError] = useState<string | null>(null)
  const [climate, setClimate] = useState(finca?.climate ?? '')
  const [farmType, setFarmType] = useState<FarmType>(finca?.farmType ?? 'EN_TRANSICION')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    let exactLocation: Record<string, unknown> | undefined
    if (exactLocationJson.trim()) {
      try {
        const parsed: unknown = JSON.parse(exactLocationJson)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
        exactLocation = parsed as Record<string, unknown>
        setLocationError(null)
      } catch {
        setLocationError('La geometría exacta debe ser un objeto JSON válido.')
        return
      }
    }
    const body = {
      name: name.trim(),
      identifier: optionalText(identifier) ?? null,
      municipality: optionalText(region === OTRO || municipality === OTRO ? otroMunicipio : municipality) ?? null,
      region: optionalText(region === OTRO ? otraRegion : region) ?? null,
      village: optionalText(vereda) ?? null,
      latitude: parseOptionalNumber(latitude) ?? null,
      longitude: parseOptionalNumber(longitude) ?? null,
      publicLocation: parseOptionalNumber(publicLatitude) !== undefined && parseOptionalNumber(publicLongitude) !== undefined
        ? { latitude: parseOptionalNumber(publicLatitude), longitude: parseOptionalNumber(publicLongitude) }
        : null,
      exactLocation: exactLocation ?? null,
      ...(role === 'ADMIN_CUMBRES' ? { ownerId: ownerId || undefined } : {}),
      locationVisibility,
      areaHa: parseOptionalNumber(area) ?? null,
      climate: optionalText(climate) ?? null,
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
        {role === 'ADMIN_CUMBRES' && <div className="form-grid"><SelectField label="Propietario" optional value={ownerId} onChange={(e) => setOwnerId(e.target.value)}><option value="">Asignarme / sin cambio</option>{(usuarios.data ?? []).map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email ?? user.phone ?? 'sin contacto'}</option>)}</SelectField></div>}
        <div className="form-grid"><label className="field"><span>Geometría exacta de la finca (JSON, opcional)</span><textarea rows={3} value={exactLocationJson} onChange={(e) => setExactLocationJson(e.target.value)} placeholder='{"type":"Point","coordinates":[-76.05,1.89]}' /><small>Se mantiene privada. Usa los campos de latitud y longitud si solo tienes un punto.</small></label></div>
        {locationError && <p className="notice notice-error" role="alert">{locationError}</p>}
        <div className="form-grid">
          <TextField label="Vereda" optional value={vereda} onChange={(e) => setVereda(e.target.value)} />
          <TextField label="Latitud exacta" type="number" min="-90" max="90" step="any" optional inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)} hint="Solo uso interno. Ej: 1.8892" />
          <TextField label="Longitud exacta" type="number" min="-180" max="180" step="any" optional inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)} hint="Solo uso interno. Ej: -76.0534" />
          <TextField label="Latitud pública aproximada" type="number" min="-90" max="90" step="any" optional inputMode="decimal" value={publicLatitude} onChange={(e) => setPublicLatitude(e.target.value)} />
          <TextField label="Longitud pública aproximada" type="number" min="-180" max="180" step="any" optional inputMode="decimal" value={publicLongitude} onChange={(e) => setPublicLongitude(e.target.value)} />
          <SelectField label="Visibilidad de la ubicación" value={locationVisibility ?? 'PRIVADA'} onChange={(e) => setLocationVisibility(e.target.value as Farm['locationVisibility'])}>
            <option value="PRIVADA">Privada</option><option value="FINCA">Solo miembros de la finca</option><option value="ORGANIZACION">Organización</option><option value="PUBLICA">Pública</option>
          </SelectField>
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
