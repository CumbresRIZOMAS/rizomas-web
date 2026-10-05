import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { Crop, FarmDetail, LotDetail } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { formatDate, formatHa, optionalText } from '../../shared/format'
import { Empty, ErrorNotice, FormCard, Loading, PageHeader, TextField } from '../../shared/ui'
import { LaboresPanel } from '../labores/LaboresPanel'

export function LoteDetailPage() {
  const { lotId = '' } = useParams()
  const { role } = useAuth()
  const lote = useApiQuery<LotDetail>(`/lots/${lotId}`)
  // Las labores necesitan los lotes y cultivos de toda la finca (regla xor).
  const finca = useApiQuery<FarmDetail>(lote.data ? `/farms/${lote.data.farmId}` : null)
  const [agregandoCultivo, setAgregandoCultivo] = useState(false)

  if (lote.loading && !lote.data) return <Loading />
  if (lote.error) return <ErrorNotice message={lote.error} onRetry={lote.reload} />
  if (!lote.data) return null
  const l = lote.data

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link to="/fincas">Fincas</Link> / <Link to={`/fincas/${l.farm.id}`}>{l.farm.name}</Link>
          </>
        }
        eyebrow="Lote"
        title={l.name}
        subtitle={[formatHa(l.areaHa), l.identifier].filter(Boolean).join(' · ')}
      />

      <div className="stack">
        <section className="card">
          <div className="section-head">
            <h2 className="section-title">Cultivos</h2>
            {canDo(role, ROLES.registrarEnFinca) && !agregandoCultivo && (
              <button type="button" className="btn btn-secondary" onClick={() => setAgregandoCultivo(true)}>
                + Agregar cultivo
              </button>
            )}
          </div>
          {l.crops.length === 0 ? (
            <Empty title="Sin cultivos">Registra la especie y variedad sembrada en este lote.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Especie</th>
                    <th>Variedad</th>
                    <th>Siembra</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {l.crops.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.species}</strong>
                      </td>
                      <td>{c.variety ?? '—'}</td>
                      <td className="num">{formatDate(c.plantingDate)}</td>
                      <td>{c.status ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {agregandoCultivo && (
          <CultivoForm
            lotId={l.id}
            onCancel={() => setAgregandoCultivo(false)}
            onSaved={() => {
              setAgregandoCultivo(false)
              lote.reload()
              finca.reload()
            }}
          />
        )}

        <div>
          <h2 className="section-title">Labores del lote</h2>
          {finca.error && <ErrorNotice message={finca.error} onRetry={finca.reload} />}
          {finca.data ? <LaboresPanel farmId={l.farmId} lots={finca.data.lots} lotId={l.id} /> : !finca.error && <Loading />}
        </div>
      </div>
    </>
  )
}

function CultivoForm({ lotId, onSaved, onCancel }: { lotId: string; onSaved: (c: Crop) => void; onCancel: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const [species, setSpecies] = useState('Café arábica')
  const [variety, setVariety] = useState('')
  const [plantingDate, setPlantingDate] = useState('')
  const [status, setStatus] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const cultivo = await mutate<Crop>('/crops', 'POST', {
      lotId,
      species: species.trim(),
      variety: optionalText(variety),
      plantingDate: plantingDate || undefined,
      status: optionalText(status),
    })
    if (cultivo) onSaved(cultivo)
  }

  return (
    <FormCard title="Agregar cultivo">
      <form className="form" onSubmit={onSubmit}>
        <div className="form-row">
          <TextField label="Especie" required value={species} onChange={(e) => setSpecies(e.target.value)} />
          <TextField label="Variedad" optional value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="Ej: Castillo" />
          <TextField label="Fecha de siembra" optional type="date" value={plantingDate} onChange={(e) => setPlantingDate(e.target.value)} />
          <TextField label="Estado" optional value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Ej: En producción" />
        </div>
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !species.trim()}>
            {saving ? 'Guardando…' : 'Guardar cultivo'}
          </button>
        </div>
      </form>
    </FormCard>
  )
}
