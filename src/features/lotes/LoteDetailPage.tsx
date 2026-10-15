import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { Crop, Labor, LotDetail } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { formatDate, formatHa, optionalText } from '../../shared/format'
import { Button, Card, CardTitle, Empty, ErrorNotice, FormCard, Loading, PageHeader, TextField } from '../../shared/ui'
import { LaborTimeline } from '../labores/LaborTimeline'

export function LoteDetailPage() {
  const { lotId = '' } = useParams()
  const { role } = useAuth()
  const lote = useApiQuery<LotDetail>(`/lots/${lotId}`)
  const labores = useApiQuery<Labor[]>(lote.data ? `/farms/${lote.data.farmId}/labors` : null)
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
            <Link to="/fincas">Fincas</Link> / <Link to={`/fincas/${l.farm.id}`}>{l.farm.name}</Link> / <span>{l.name}</span>
          </>
        }
        eyebrow="Lote"
        title={`Lote ${l.name}`}
        subtitle={[formatHa(l.areaHa), l.identifier].filter(Boolean).join(' · ')}
      />

      <div className="stack">
        <Card className="card-pad">
          <CardTitle title="Cultivos" subtitle="Especies y variedades sembradas en el lote">
            {canDo(role, ROLES.registrarEnFinca) && !agregandoCultivo && (
              <Button variant="secondary" icon="plus" onClick={() => setAgregandoCultivo(true)}>
                Agregar cultivo
              </Button>
            )}
          </CardTitle>
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
        </Card>

        {agregandoCultivo && (
          <CultivoForm
            lotId={l.id}
            onCancel={() => setAgregandoCultivo(false)}
            onSaved={() => {
              setAgregandoCultivo(false)
              lote.reload()
            }}
          />
        )}

        <Card className="card-pad">
          <CardTitle title="Labores del lote" subtitle="Incluye las registradas sobre sus cultivos" />
        </Card>
        {labores.error && <ErrorNotice message={labores.error} onRetry={labores.reload} />}
        {labores.loading && !labores.data && <Loading />}
        {labores.data && (
          <LaborTimeline
            labors={labores.data.filter((x) => x.lotId === l.id || (x.cropId !== null && l.crops.some((c) => c.id === x.cropId)))}
            lotName={(id) => (id === l.id ? l.name : undefined)}
          />
        )}
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
      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <TextField label="Especie" required value={species} onChange={(e) => setSpecies(e.target.value)} />
          <TextField label="Variedad" optional value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="Ej: Castillo" />
          <TextField label="Fecha de siembra" optional type="date" value={plantingDate} onChange={(e) => setPlantingDate(e.target.value)} />
          <TextField label="Estado" optional value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Ej: En producción" />
        </div>
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" icon="check" disabled={saving || !species.trim()}>
            {saving ? 'Guardando…' : 'Guardar cultivo'}
          </Button>
        </div>
      </form>
    </FormCard>
  )
}
