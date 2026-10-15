import { useState, type FormEvent } from 'react'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { ReferenceRange } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { formatDate, formatNumber, optionalText, parseOptionalNumber, toNumber } from '../../shared/format'
import { Empty, ErrorNotice, FormCard, Loading, PageHeader, TextField } from '../../shared/ui'

/**
 * Catálogo de rangos de referencia de suelo (RF-11). Contra estos rangos el
 * backend diagnostica cada parámetro de un análisis como bajo, óptimo o alto.
 */
export function RangosPage() {
  const { role } = useAuth()
  const puedeEditar = canDo(role, ROLES.editarRangosSuelo)
  const { data, error, loading, reload } = useApiQuery<ReferenceRange[]>('/soil-reference-ranges')
  const { mutate, error: errorBorrar } = useApiMutation()
  const [editando, setEditando] = useState<ReferenceRange | 'nuevo' | null>(null)

  async function borrar(rango: ReferenceRange) {
    const etiqueta = `${rango.parameter}${rango.crop ? ` (${rango.crop})` : ''}`
    if (!window.confirm(`¿Eliminar el rango de ${etiqueta}? Los análisis nuevos de ese parámetro quedarán sin referencia.`)) return
    if ((await mutate(`/soil-reference-ranges/${rango.id}`, 'DELETE')) !== null) reload()
  }

  return (
    <>
      <PageHeader
        eyebrow="Suelos"
        title="Rangos de referencia"
        subtitle="Contra estos rangos se diagnostica cada parámetro de un análisis de suelo. Un rango de un cultivo tiene prioridad sobre el general."
        actions={
          puedeEditar &&
          editando === null && (
            <button type="button" className="btn btn-primary" onClick={() => setEditando('nuevo')}>
              + Nuevo rango
            </button>
          )
        }
      />

      <div className="stack">
        {data && data.length === 0 && (
          <div className="notice notice-warn">
            El catálogo está vacío: mientras no haya rangos, todos los diagnósticos salen “sin referencia”. Cárgalos con su fuente (laboratorio,
            Cenicafé…).
          </div>
        )}

        {editando !== null && (
          <RangoForm
            rango={editando === 'nuevo' ? undefined : editando}
            onCancel={() => setEditando(null)}
            onSaved={() => {
              setEditando(null)
              reload()
            }}
          />
        )}

        {errorBorrar && <ErrorNotice message={errorBorrar} />}

        <section className="card">
          {loading && !data && <Loading />}
          {error && <ErrorNotice message={error} onRetry={reload} />}
          {data && data.length === 0 && <Empty title="Sin rangos todavía" />}
          {data && data.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Parámetro</th>
                    <th>Cultivo</th>
                    <th>Mínimo</th>
                    <th>Máximo</th>
                    <th>Unidad</th>
                    <th>Fuente</th>
                    {puedeEditar && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.parameter}</strong>
                        {r.notes && <div className="meta">{r.notes}</div>}
                      </td>
                      <td>{r.crop ? <span className="tag tag-green">{r.crop}</span> : <span className="meta">Cualquiera</span>}</td>
                      <td className="num">{formatNumber(r.min)}</td>
                      <td className="num">{formatNumber(r.max)}</td>
                      <td>{r.unit ?? '—'}</td>
                      <td className="meta">
                        {r.source ?? '—'}
                        <div>Actualizado {formatDate(r.updatedAt)}</div>
                      </td>
                      {puedeEditar && (
                        <td>
                          <button type="button" className="btn btn-ghost" onClick={() => setEditando(r)}>
                            Editar
                          </button>
                          <button type="button" className="btn btn-danger" onClick={() => void borrar(r)}>
                            Eliminar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

function RangoForm({ rango, onSaved, onCancel }: { rango?: ReferenceRange; onSaved: () => void; onCancel: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const [parameter, setParameter] = useState(rango?.parameter ?? '')
  const [crop, setCrop] = useState(rango?.crop ?? '')
  const [min, setMin] = useState(toNumber(rango?.min)?.toString() ?? '')
  const [max, setMax] = useState(toNumber(rango?.max)?.toString() ?? '')
  const [unit, setUnit] = useState(rango?.unit ?? '')
  const [source, setSource] = useState(rango?.source ?? '')
  const [notes, setNotes] = useState(rango?.notes ?? '')

  const minN = parseOptionalNumber(min)
  const maxN = parseOptionalNumber(max)
  const sinLimites = minN === undefined && maxN === undefined
  const invertido = minN !== undefined && maxN !== undefined && minN > maxN

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const body = {
      parameter: parameter.trim(),
      crop: crop.trim(),
      min: minN ?? null,
      max: maxN ?? null,
      unit: optionalText(unit),
      source: optionalText(source),
      notes: optionalText(notes),
    }
    const ok = rango
      ? await mutate(`/soil-reference-ranges/${rango.id}`, 'PATCH', body)
      : await mutate('/soil-reference-ranges', 'POST', body)
    if (ok) onSaved()
  }

  return (
    <FormCard title={rango ? `Editar rango de ${rango.parameter}` : 'Nuevo rango'}>
      <form className="form" onSubmit={onSubmit}>
        <div className="form-row">
          <TextField label="Parámetro" required value={parameter} onChange={(e) => setParameter(e.target.value)} placeholder="Ej: pH, Fósforo" />
          <TextField
            label="Cultivo"
            optional
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            placeholder="Vacío = cualquier cultivo"
            hint="Escríbelo igual que en el cultivo del lote, p. ej. “Café arábica”."
          />
        </div>
        <div className="form-row">
          <TextField label="Mínimo" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
          <TextField label="Máximo" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} />
          <TextField label="Unidad" optional value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Ej: mg/kg" />
        </div>
        <div className="form-row">
          <TextField label="Fuente" optional value={source} onChange={(e) => setSource(e.target.value)} placeholder="Ej: Cenicafé, Avance Técnico 2023" />
          <TextField label="Notas" optional value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {sinLimites && <p className="hint">Indica al menos un mínimo o un máximo.</p>}
        {invertido && <div className="notice notice-warn">El mínimo no puede ser mayor que el máximo.</div>}
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !parameter.trim() || sinLimites || invertido}>
            {saving ? 'Guardando…' : 'Guardar rango'}
          </button>
        </div>
      </form>
    </FormCard>
  )
}
