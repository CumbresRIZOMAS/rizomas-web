import { useEffect, useState } from 'react'
import { api } from '../../shared/api/client'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { Evidence, EvidenceStatus, SignedUrl } from '../../shared/api/types'
import { useAuth } from '../../shared/auth/context'
import { useActiveFarm } from '../../shared/farm/context'
import { formatDate, formatShortDate, toNumber } from '../../shared/format'
import { Button, Card, Chip, EmptyState, ErrorNotice, Icon, Loading, PageHeader, type ChipTone } from '../../shared/ui'

const ESTADO: Record<EvidenceStatus, { label: string; tone: ChipTone }> = {
  PENDIENTE: { label: 'Pendiente', tone: 'amber' },
  EN_REVISION: { label: 'En revisión', tone: 'blue' },
  APROBADA: { label: 'Aprobada', tone: 'green' },
  RECHAZADA: { label: 'Rechazada', tone: 'terra' },
  CUARENTENA: { label: 'Cuarentena', tone: 'gray' },
}

/** URL prefirmada temporal para ver la foto; el bucket de R2 nunca es público. */
function useFoto(objectKey: string): string | null {
  const { token } = useAuth()
  const [url, setUrl] = useState<{ key: string; url: string | null } | null>(null)
  useEffect(() => {
    let vigente = true
    api<SignedUrl>('/evidence/download-url', { method: 'POST', token: token ?? undefined, body: { objectKey } })
      .then((r) => vigente && setUrl({ key: objectKey, url: r.url }))
      .catch(() => vigente && setUrl({ key: objectKey, url: null }))
    return () => {
      vigente = false
    }
  }, [objectKey, token])
  return url?.key === objectKey ? url.url : null
}

function Foto({ evidence, size }: { evidence: Evidence; size: number }) {
  const url = useFoto(evidence.objectKey)
  return url ? <img src={url} alt={`Evidencia del ${formatDate(evidence.capturedAt ?? evidence.createdAt)}`} /> : <Icon name="camera" size={size} />
}

/** Bandeja de revisión manual de evidencias (RF-17). */
export function EvidenciasPage() {
  const { data, error, loading, reload } = useApiQuery<Evidence[]>('/evidence/moderation/pending')
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const lista = data ?? []
  const actual = lista.find((e) => e.id === seleccion) ?? lista[0] ?? null

  return (
    <div>
      <PageHeader
        eyebrow="Control de calidad"
        title="Evidencias fotográficas"
        subtitle={data ? `${lista.length} ${lista.length === 1 ? 'fotografía pendiente' : 'fotografías pendientes'} de revisión.` : 'Revisa y valida las fotografías enviadas desde campo.'}
      />
      {loading && !data && <Loading />}
      {error && <ErrorNotice message={error} onRetry={reload} />}
      {data && lista.length === 0 && (
        <EmptyState icon="check" title="No hay evidencias pendientes">
          Las fotos que se suben desde la app o el panel llegan aquí para revisión antes de publicarse.
        </EmptyState>
      )}
      {lista.length > 0 && actual && (
        <div className="evidence-layout">
          <div className="photo-grid">
            {lista.map((e, i) => (
              <button type="button" className={`photo-card photo-${i % 6} ${actual.id === e.id ? 'selected' : ''}`} onClick={() => setSeleccion(e.id)} key={e.id}>
                <div className="photo-art">
                  <Foto evidence={e} size={38} />
                </div>
                <Chip tone={ESTADO[e.status].tone}>{ESTADO[e.status].label}</Chip>
                <div>
                  <strong>{e.laborId ? 'Evidencia de labor' : 'Evidencia de finca'}</strong>
                  <span>Subida el {formatShortDate(e.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
          <Moderacion
            key={actual.id}
            evidence={actual}
            onDone={() => {
              setSeleccion(null)
              reload()
            }}
          />
        </div>
      )}
    </div>
  )
}

function Moderacion({ evidence, onDone }: { evidence: Evidence; onDone: () => void }) {
  const { farms } = useActiveFarm()
  const { mutate, saving, error } = useApiMutation()
  const [motivo, setMotivo] = useState('')
  const score = toNumber(evidence.moderationScore)
  const finca = farms.find((f) => f.id === evidence.farmId)

  async function moderar(status: EvidenceStatus) {
    const ok = await mutate(`/evidence/${evidence.id}/moderation`, 'PATCH', {
      status,
      rejectionReason: motivo.trim() || undefined,
      moderationEngine: 'MANUAL',
    })
    if (ok) onDone()
  }

  return (
    <Card className="moderation-panel">
      <div className="panel-photo">
        <Foto evidence={evidence} size={56} />
      </div>
      <Chip tone={ESTADO[evidence.status].tone}>{ESTADO[evidence.status].label}</Chip>
      <h2>{evidence.laborId ? 'Evidencia de labor' : 'Evidencia de finca'}</h2>
      <dl>
        <div>
          <dt>Finca</dt>
          <dd>{finca?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>Labor</dt>
          <dd>{evidence.laborId ? evidence.laborId.slice(0, 8).toUpperCase() : 'Sin labor'}</dd>
        </div>
        <div>
          <dt>Captura</dt>
          <dd>{formatDate(evidence.capturedAt)}</dd>
        </div>
        <div>
          <dt>Ubicación</dt>
          <dd>{evidence.geolocation ? 'Con geolocalización' : 'Sin geolocalización'}</dd>
        </div>
        <div>
          <dt>Moderación automática</dt>
          <dd>
            <strong>{score === null ? 'Sin puntaje' : `${Math.round(score * 100)} / 100`}</strong>
            {evidence.moderationEngine && ` · ${evidence.moderationEngine}`}
          </dd>
        </div>
      </dl>
      <label className="field">
        <span>Motivo u observación</span>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Obligatorio para rechazar. Escribe una observación clara..." />
      </label>
      {error && (
        <div style={{ marginTop: 10 }}>
          <ErrorNotice message={error} />
        </div>
      )}
      <div className="moderation-actions">
        <Button variant="danger" disabled={saving || !motivo.trim()} onClick={() => void moderar('RECHAZADA')}>
          Rechazar
        </Button>
        <Button icon="check" disabled={saving} onClick={() => void moderar('APROBADA')}>
          Aprobar
        </Button>
      </div>
    </Card>
  )
}
