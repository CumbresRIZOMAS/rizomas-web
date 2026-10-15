import { useState, type FormEvent } from 'react'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { Bioinput, BioinputDetail, Farm, FarmDetail, Ingredient } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { RequireFarm } from '../../shared/farm/RequireFarm'
import { formatDate, formatNumber, formatShortDate, optionalText, parseOptionalNumber } from '../../shared/format'
import { Button, Card, CardTitle, Chip, Empty, EmptyState, ErrorNotice, FormCard, Icon, Loading, PageHeader, SelectField, TextAreaField, TextField } from '../../shared/ui'

export function BioinsumosPage() {
  return <RequireFarm>{(farm) => <Bioinsumos key={farm.id} farm={farm} />}</RequireFarm>
}

/** Bioinsumos de la finca (RF-13): elaboración, composición, aplicación y trazabilidad. */
function Bioinsumos({ farm }: { farm: Farm }) {
  const { role } = useAuth()
  const puedeRegistrar = canDo(role, ROLES.registrarEnFinca)
  const lista = useApiQuery<Bioinput[]>(`/farms/${farm.id}/bioinputs`)
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const actualId = seleccion ?? lista.data?.[0]?.id ?? null
  const detalle = useApiQuery<BioinputDetail>(actualId ? `/bioinputs/${actualId}` : null)

  return (
    <div>
      <PageHeader
        eyebrow="Manejo regenerativo"
        title="Bioinsumos"
        subtitle="Recetas, lotes de producción y aplicaciones en campo."
        actions={
          puedeRegistrar &&
          !creando && (
            <Button icon="plus" onClick={() => setCreando(true)}>
              Nuevo bioinsumo
            </Button>
          )
        }
      />
      <div className="stack">
        {creando && (
          <BioinsumoForm
            farmId={farm.id}
            onCancel={() => setCreando(false)}
            onSaved={(b) => {
              setCreando(false)
              setSeleccion(b.id)
              lista.reload()
            }}
          />
        )}
        {lista.loading && !lista.data && <Loading />}
        {lista.error && <ErrorNotice message={lista.error} onRetry={lista.reload} />}
        {lista.data && lista.data.length === 0 && !creando && (
          <EmptyState icon="drop" title="Sin bioinsumos registrados">
            Registra la receta y producción de los bioinsumos que se elaboran en la finca.
          </EmptyState>
        )}
        {lista.data && lista.data.length > 0 && (
          <div className="filter-tabs" role="tablist" aria-label="Bioinsumos">
            {lista.data.map((b) => (
              <button key={b.id} type="button" role="tab" aria-selected={b.id === actualId} className={b.id === actualId ? 'active' : ''} onClick={() => setSeleccion(b.id)}>
                {b.name}
              </button>
            ))}
          </div>
        )}
        {detalle.error && <ErrorNotice message={detalle.error} onRetry={detalle.reload} />}
        {detalle.loading && !detalle.data && actualId && <Loading />}
        {detalle.data && <Detalle bio={detalle.data} farm={farm} puedeRegistrar={puedeRegistrar} onApplied={detalle.reload} />}
      </div>
    </div>
  )
}

function Detalle({ bio, farm, puedeRegistrar, onApplied }: { bio: BioinputDetail; farm: Farm; puedeRegistrar: boolean; onApplied: () => void }) {
  const [aplicando, setAplicando] = useState(false)
  const ingredientes: Ingredient[] = Array.isArray(bio.ingredients) ? bio.ingredients : []

  return (
    <div className="bio-grid">
      <Card className="recipe-card">
        <div className="recipe-top">
          <div className="bio-icon">
            <Icon name="drop" size={30} />
          </div>
          <div>
            <Chip tone={bio.producedAt ? 'green' : 'amber'}>{bio.producedAt ? 'Producido' : 'Receta'}</Chip>
            <h2>{bio.name}</h2>
            <p>{bio.applications.length} aplicaciones registradas</p>
          </div>
        </div>
        <div className="recipe-stats">
          <span>
            <small>Registro</small>
            <strong>{bio.id.slice(0, 8).toUpperCase()}</strong>
          </span>
          <span>
            <small>Cantidad</small>
            <strong>{bio.quantity !== null ? `${formatNumber(bio.quantity)} ${bio.unit ?? ''}` : '—'}</strong>
          </span>
          <span>
            <small>Producción</small>
            <strong>{formatDate(bio.producedAt)}</strong>
          </span>
        </div>
        <h3>Ingredientes principales</h3>
        {ingredientes.length === 0 ? (
          <Empty title="Sin ingredientes registrados" />
        ) : (
          <ul>
            {ingredientes.map((i) => (
              <li key={i.name}>
                {i.name}{' '}
                <strong>
                  {i.quantity !== undefined ? formatNumber(i.quantity) : ''} {i.unit ?? ''}
                </strong>
              </li>
            ))}
          </ul>
        )}
        {bio.preparation && (
          <>
            <h3>Preparación</h3>
            <p className="muted" style={{ fontSize: 9, lineHeight: 1.6 }}>
              {bio.preparation}
            </p>
          </>
        )}
      </Card>
      <Card>
        <CardTitle title="Aplicaciones recientes" subtitle="Dónde y cuándo se usó">
          {puedeRegistrar && !aplicando && (
            <Button variant="secondary" icon="plus" onClick={() => setAplicando(true)}>
              Registrar aplicación
            </Button>
          )}
        </CardTitle>
        {aplicando && (
          <AplicacionForm
            bio={bio}
            farm={farm}
            onCancel={() => setAplicando(false)}
            onSaved={() => {
              setAplicando(false)
              onApplied()
            }}
          />
        )}
        {bio.applications.length === 0 && !aplicando && <Empty title="Sin aplicaciones registradas" />}
        {bio.applications.map((a) => (
          <div className="application-row" key={a.id}>
            <div className="date-box">{formatShortDate(a.appliedAt)}</div>
            <div>
              <strong>{a.lot?.name ?? 'Lote'}</strong>
              <span>{[a.labor?.name, a.observations].filter(Boolean).join(' · ') || 'Sin observaciones'}</span>
            </div>
            {a.quantity !== null && (
              <Chip>
                {formatNumber(a.quantity)} {a.unit ?? ''}
              </Chip>
            )}
          </div>
        ))}
      </Card>
    </div>
  )
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

function AplicacionForm({ bio, farm, onSaved, onCancel }: { bio: BioinputDetail; farm: Farm; onSaved: () => void; onCancel: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const detalle = useApiQuery<FarmDetail>(`/farms/${farm.id}`)
  const lots = detalle.data?.lots ?? []
  const [lotId, setLotId] = useState('')
  const [appliedAt, setAppliedAt] = useState(hoy())
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState(bio.unit ?? 'L')
  const [observations, setObservations] = useState('')
  const lote = lotId || lots[0]?.id || ''

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const ok = await mutate('/bioinputs/applications', 'POST', {
      bioinputId: bio.id,
      lotId: lote,
      appliedAt,
      quantity: parseOptionalNumber(quantity),
      unit: optionalText(unit),
      observations: optionalText(observations),
    })
    if (ok) onSaved()
  }

  return (
    <form className="rec-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <SelectField label="Lote *" value={lote} onChange={(e) => setLotId(e.target.value)}>
          {lots.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </SelectField>
        <TextField label="Fecha *" type="date" required value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} />
        <TextField label="Cantidad" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <TextField label="Unidad" value={unit} onChange={(e) => setUnit(e.target.value)} />
      </div>
      <TextAreaField label="Observaciones" value={observations} onChange={(e) => setObservations(e.target.value)} />
      {error && <ErrorNotice message={error} />}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving || !lote}>
          {saving ? 'Guardando…' : 'Guardar aplicación'}
        </Button>
      </div>
    </form>
  )
}

type FilaIngrediente = { key: number; name: string; quantity: string; unit: string }

function BioinsumoForm({ farmId, onSaved, onCancel }: { farmId: string; onSaved: (b: Bioinput) => void; onCancel: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const [name, setName] = useState('')
  const [producedAt, setProducedAt] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('L')
  const [preparation, setPreparation] = useState('')
  const [ingredientes, setIngredientes] = useState<FilaIngrediente[]>([{ key: 0, name: '', quantity: '', unit: '' }])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const creado = await mutate<Bioinput>('/bioinputs', 'POST', {
      farmId,
      name: name.trim(),
      producedAt: producedAt || undefined,
      quantity: parseOptionalNumber(quantity),
      unit: optionalText(unit),
      preparation: optionalText(preparation),
      ingredients: ingredientes
        .filter((i) => i.name.trim())
        .map((i) => ({ name: i.name.trim(), quantity: parseOptionalNumber(i.quantity), unit: optionalText(i.unit) })),
    })
    if (creado) onSaved(creado)
  }

  function editar(key: number, cambio: Partial<FilaIngrediente>) {
    setIngredientes((prev) => prev.map((i) => (i.key === key ? { ...i, ...cambio } : i)))
  }

  return (
    <FormCard title="Nuevo bioinsumo">
      <form onSubmit={onSubmit}>
        <div className="form-grid three">
          <TextField label="Nombre *" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Biol de montaña" />
          <TextField label="Fecha de producción" type="date" value={producedAt} onChange={(e) => setProducedAt(e.target.value)} />
          <div className="form-grid">
            <TextField label="Cantidad" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <TextField label="Unidad" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
        </div>
        <div className="parameter-entry">
          <strong>Ingrediente</strong>
          <strong>Cantidad</strong>
          <strong>Unidad</strong>
          <strong />
          {ingredientes.map((i) => (
            <IngredienteFila key={i.key} fila={i} onChange={(c) => editar(i.key, c)} onRemove={() => setIngredientes((prev) => prev.filter((x) => x.key !== i.key))} />
          ))}
        </div>
        <div>
          <Button variant="ghost" icon="plus" onClick={() => setIngredientes((prev) => [...prev, { key: Date.now(), name: '', quantity: '', unit: '' }])}>
            Agregar ingrediente
          </Button>
        </div>
        <TextAreaField label="Preparación" value={preparation} onChange={(e) => setPreparation(e.target.value)} placeholder="Pasos, tiempos de fermentación, temperatura…" />
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" icon="check" disabled={saving || !name.trim()}>
            {saving ? 'Guardando…' : 'Guardar bioinsumo'}
          </Button>
        </div>
      </form>
    </FormCard>
  )
}

function IngredienteFila({ fila, onChange, onRemove }: { fila: FilaIngrediente; onChange: (c: Partial<FilaIngrediente>) => void; onRemove: () => void }) {
  return (
    <>
      <input aria-label="Ingrediente" value={fila.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Ej. Melaza" />
      <input aria-label="Cantidad del ingrediente" inputMode="decimal" value={fila.quantity} onChange={(e) => onChange({ quantity: e.target.value })} />
      <input aria-label="Unidad del ingrediente" value={fila.unit} onChange={(e) => onChange({ unit: e.target.value })} placeholder="kg, L…" />
      <button type="button" className="icon-button" onClick={onRemove} aria-label="Quitar ingrediente">
        <Icon name="close" size={16} />
      </button>
    </>
  )
}
