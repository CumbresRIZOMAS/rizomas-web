import { useState, type FormEvent } from 'react'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { Farm, FarmPublication, FarmTraceability } from '../../shared/api/types'
import { formatDate, formatNumber, optionalText, parseOptionalNumber, toNumber } from '../../shared/format'
import { Button, Card, CardTitle, Chip, Empty, ErrorNotice, Loading, SelectField, TextField } from '../../shared/ui'
import { FotosPublicacion } from './FotosPublicacion'

/**
 * Publicación selectiva en el portal (RF-18): se elige qué cosecha mostrar y
 * con qué título. El portal solo recibe región, cantidad y fotos aprobadas.
 */
export function Publicaciones({ farm, traza }: { farm: Farm; traza: FarmTraceability }) {
  const { data, error, loading, reload } = useApiQuery<FarmPublication[]>(`/publications/farms/${farm.id}`)
  const estado = useApiMutation()
  const [creando, setCreando] = useState(false)
  const [fotosDe, setFotosDe] = useState<string | null>(null)
  const cosechas = traza.labors.filter((l) => l.type === 'COSECHA' && l.harvest?.id)

  async function cambiar(p: FarmPublication) {
    if (await estado.mutate(`/publications/${p.id}/status`, 'PATCH', { active: !p.active })) reload()
  }

  return (
    <Card className="card-pad" label="Publicaciones del portal">
      <CardTitle title="Publicaciones en el portal" subtitle="Qué ven compradores y visitantes de esta finca">
        {!creando && (
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
  onSaved,
  onCancel,
}: {
  farm: Farm
  cosechas: FarmTraceability['labors']
  onSaved: () => void
  onCancel: () => void
}) {
  const { mutate, saving, error } = useApiMutation()
  const primera = cosechas[0]
  const [harvestId, setHarvestId] = useState(primera?.harvest?.id ?? '')
  const [title, setTitle] = useState('')
  const [region, setRegion] = useState(farm.region ?? '')
  const [quantity, setQuantity] = useState(primera?.harvest ? String(toNumber(primera.harvest.quantity) ?? '') : '')
  const [unit, setUnit] = useState(primera?.harvest?.unit ?? 'kg')

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
    const ok = await mutate('/publications', 'POST', {
      farmId: farm.id,
      harvestId: harvestId || undefined,
      title: title.trim(),
      region: optionalText(region),
      quantity: parseOptionalNumber(quantity),
      unit: optionalText(unit),
    })
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
        <TextField label="Región" value={region} onChange={(e) => setRegion(e.target.value)} hint="Solo la región: nunca se publican coordenadas ni el nombre de la finca." />
        <div className="form-grid">
          <TextField label="Cantidad" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <TextField label="Unidad" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
      </div>
      <p className="muted" style={{ fontSize: 9 }}>
        Se crea como borrador y no sale en el portal hasta que la publiques. Después puedes elegir sus fotos entre las aprobadas como públicas en Evidencias.
      </p>
      {error && <ErrorNotice message={error} />}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" icon="check" disabled={saving || !title.trim()}>
          Guardar borrador
        </Button>
      </div>
    </form>
  )
}
