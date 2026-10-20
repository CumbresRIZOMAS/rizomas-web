import { useState, type FormEvent } from 'react'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { Farm, FarmPublication, FarmTraceability } from '../../shared/api/types'
import { formatDate, formatNumber, optionalText, parseOptionalNumber, toNumber } from '../../shared/format'
import { Button, Card, CardTitle, Chip, Empty, ErrorNotice, Loading, SelectField, TextAreaField, TextField } from '../../shared/ui'
import { FotosPublicacion } from './FotosPublicacion'

/**
 * Publicación selectiva en el portal (RF-18): se elige qué cosecha mostrar y
 * con qué título. El portal solo recibe región, cantidad y fotos aprobadas.
 */
export function Publicaciones({ farm, traza }: { farm: Farm; traza: FarmTraceability }) {
  const { data, error, loading, reload } = useApiQuery<FarmPublication[]>(`/publications/farms/${farm.id}`)
  const estado = useApiMutation()
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [fotosDe, setFotosDe] = useState<string | null>(null)
  const cosechas = traza.labors.filter((l) => l.type === 'COSECHA' && l.harvest?.id)

  async function cambiar(p: FarmPublication) {
    if (await estado.mutate(`/publications/${p.id}/status`, 'PATCH', { active: !p.active })) reload()
  }

  return (
    <Card className="card-pad" label="Publicaciones del portal">
      <CardTitle title="Perfil público de la finca" subtitle="Descripción, ubicación compartida, cosecha e imágenes que aparecen en el mapa y la trazabilidad">
        {!creando && !editando && (
          <Button variant="secondary" icon="plus" onClick={() => setCreando(true)}>
            Nueva publicación
          </Button>
        )}
      </CardTitle>
      {creando && (
        <PublicacionForm
          farm={farm}
          cosechas={cosechas}
          onCancel={() => setCreando(false)}
          onSaved={() => {
            setCreando(false)
            reload()
          }}
        />
      )}
      {editando && data?.find((p) => p.id === editando) && (
        <PublicacionForm
          farm={farm}
          cosechas={cosechas}
          publication={data.find((p) => p.id === editando)!}
          onCancel={() => setEditando(null)}
          onSaved={() => { setEditando(null); reload() }}
        />
      )}
      {loading && !data && <Loading />}
      {error && <ErrorNotice message={error} onRetry={reload} />}
      {estado.error && <ErrorNotice message={estado.error} />}
      {data && data.length === 0 && !creando && <Empty title="Esta finca no tiene publicaciones">Publica una cosecha para que aparezca en el portal de orígenes.</Empty>}
      {data?.map((p) => (
        <div key={p.id}>
          <div className="application-row">
            <div className="date-box">{p.active ? 'ON' : 'OFF'}</div>
            <div>
              <strong>{p.title}</strong>
              <span>
                {[p.region, p.quantity !== null && `${formatNumber(p.quantity)} ${p.unit ?? ''}`, p.harvest && `cosecha del ${formatDate(p.harvest.labor.startDate)}`]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Chip tone={p.active ? 'green' : 'gray'}>{p.active ? 'Publicada' : 'Borrador'}</Chip>
              <Button variant="secondary" icon="camera" onClick={() => setFotosDe(fotosDe === p.id ? null : p.id)}>
                Fotos ({p.evidences?.length ?? 0})
              </Button>
              <Button variant="ghost" onClick={() => { setCreando(false); setEditando(p.id) }}>Editar perfil</Button>
              <Button variant={p.active ? 'ghost' : 'primary'} disabled={estado.saving} onClick={() => void cambiar(p)}>
                {p.active ? 'Retirar' : 'Publicar'}
              </Button>
            </div>
          </div>
          {fotosDe === p.id && (
            <FotosPublicacion
              publicationId={p.id}
              onCancel={() => setFotosDe(null)}
              onSaved={() => {
                setFotosDe(null)
                reload()
              }}
            />
          )}
        </div>
      ))}
    </Card>
  )
}

function PublicacionForm({
  farm,
  cosechas,
  publication,
  onSaved,
  onCancel,
}: {
  farm: Farm
  cosechas: FarmTraceability['labors']
  publication?: FarmPublication
  onSaved: () => void
  onCancel: () => void
}) {
  const { mutate, saving, error } = useApiMutation()
  const primera = cosechas[0]
  const [harvestId, setHarvestId] = useState(publication?.harvest?.id ?? primera?.harvest?.id ?? '')
  const [title, setTitle] = useState(publication?.title ?? '')
  const [description, setDescription] = useState(publication?.description ?? '')
  const [region, setRegion] = useState(publication?.region ?? farm.region ?? '')
  const [quantity, setQuantity] = useState(publication?.quantity != null ? String(toNumber(publication.quantity) ?? '') : primera?.harvest ? String(toNumber(primera.harvest.quantity) ?? '') : '')
  const [unit, setUnit] = useState(publication?.unit ?? primera?.harvest?.unit ?? 'kg')
  const [latitude, setLatitude] = useState(publication?.publicLocation?.latitude?.toString() ?? '')
  const [longitude, setLongitude] = useState(publication?.publicLocation?.longitude?.toString() ?? '')
  const hasLatitude = Boolean(latitude.trim())
  const hasLongitude = Boolean(longitude.trim())
  const latNumber = Number(latitude)
  const lonNumber = Number(longitude)
  const coordenadasInvalidas = hasLatitude !== hasLongitude || (hasLatitude && (!Number.isFinite(latNumber) || Math.abs(latNumber) > 90 || !Number.isFinite(lonNumber) || Math.abs(lonNumber) > 180))

  function elegirCosecha(id: string) {
    setHarvestId(id)
    const labor = cosechas.find((l) => l.harvest?.id === id)
    if (labor?.harvest) {
      setQuantity(String(toNumber(labor.harvest.quantity) ?? ''))
      setUnit(labor.harvest.unit)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const body = {
      harvestId: harvestId || (publication ? null : undefined),
      title: title.trim(),
      description: optionalText(description),
      region: optionalText(region),
      quantity: parseOptionalNumber(quantity),
      unit: optionalText(unit),
      publicLocation: latitude.trim() && longitude.trim() ? { latitude: Number(latitude), longitude: Number(longitude) } : null,
    }
    const ok = publication
      ? await mutate(`/publications/${publication.id}`, 'PATCH', body)
      : await mutate('/publications', 'POST', { farmId: farm.id, ...body })
    if (ok) onSaved()
  }

  return (
    <form className="rec-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <SelectField label="Cosecha" value={harvestId} onChange={(e) => elegirCosecha(e.target.value)}>
          <option value="">Sin cosecha asociada</option>
          {cosechas.map((l) => (
            <option key={l.id} value={l.harvest!.id}>
              {formatDate(l.startDate)} · {l.name} · {formatNumber(l.harvest!.quantity)} {l.harvest!.unit}
            </option>
          ))}
        </SelectField>
        <TextField label="Título *" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Castillo lavado de montaña" />
        <TextField label="Región" value={region} onChange={(e) => setRegion(e.target.value)} />
        <div className="form-grid">
          <TextField label="Cantidad" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <TextField label="Unidad" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
      </div>
      <TextAreaField label="Descripción pública" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Cuenta la historia de la finca, sus prácticas y lo que quieres compartir." />
      <div className="form-grid">
        <TextField label="Latitud aproximada (opcional)" type="number" min="-90" max="90" step="any" inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="Ej. 1.85" />
        <TextField label="Longitud aproximada (opcional)" type="number" min="-180" max="180" step="any" inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="Ej. -76.05" />
      </div>
      <p className="muted" style={{ fontSize: 9 }}>Estas coordenadas aparecerán en el mapa público. Usa un punto aproximado de la región; no registres la ubicación exacta de la vivienda.</p>
      <p className="muted" style={{ fontSize: 9 }}>
        {publication ? 'Los cambios se reflejan en el portal si la publicación está activa.' : 'Se crea como borrador. Después podrás elegir fotos aprobadas para el portal desde Evidencias.'}
      </p>
      {error && <ErrorNotice message={error} />}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" icon="check" disabled={saving || !title.trim() || coordenadasInvalidas}>
          {saving ? 'Guardando…' : publication ? 'Guardar perfil' : 'Guardar borrador'}
        </Button>
      </div>
    </form>
  )
}
