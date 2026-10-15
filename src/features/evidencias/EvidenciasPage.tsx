import { useEffect, useState } from 'react'
import { api } from '../../shared/api/client'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { Evidence, EvidenceStatus, SignedUrl } from '../../shared/api/types'
import { canDo, useAuth } from '../../shared/auth/context'
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

type Bandeja = 'EN_REVISION' | 'CUARENTENA' | 'PENDIENTE'

const BANDEJAS: { id: Bandeja; label: string; ayuda: string }[] = [
  { id: 'EN_REVISION', label: 'Por revisar', ayuda: 'Pasaron la moderación automática y esperan tu aprobación.' },
  { id: 'CUARENTENA', label: 'Cuarentena', ayuda: 'La moderación automática las marcó como posiblemente inapropiadas. Están ocultas hasta que decidas.' },
  { id: 'PENDIENTE', label: 'Sin moderar', ayuda: 'Todavía no pasan por la moderación automática (recién subidas o con error al leerlas).' },
]

/** Bandeja de revisión manual de evidencias (RF-17): NSFWJS clasifica, una persona decide. */
export function EvidenciasPage() {
  const { role } = useAuth()
  const [bandeja, setBandeja] = useState<Bandeja>('EN_REVISION')
  const resumen = useApiQuery<Record<EvidenceStatus, number>>('/evidence/moderation/summary')
  const { data, error, loading, reload } = useApiQuery<Evidence[]>(`/evidence/moderation?status=${bandeja}`)
  const procesar = useApiMutation()
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const lista = data ?? []
  const actual = lista.find((e) => e.id === seleccion) ?? lista[0] ?? null
  const info = BANDEJAS.find((b) => b.id === bandeja)!

  function recargar() {
    setSeleccion(null)
    reload()
    resumen.reload()
  }

  async function procesarPendientes() {
    if (await procesar.mutate('/evidence/moderation/process', 'POST')) recargar()
  }

  return (
    <div>
      <PageHeader
        eyebrow="Control de calidad"
        title="Evidencias fotográficas"
        subtitle="Revisa y valida las fotografías enviadas desde campo."
        actions={
          bandeja === 'PENDIENTE' &&
          canDo(role, ['ADMIN_CUMBRES', 'TECNICO']) &&
          lista.length > 0 && (
            <Button variant="secondary" icon="sync" disabled={procesar.saving} onClick={() => void procesarPendientes()}>
              {procesar.saving ? 'Moderando…' : 'Moderar pendientes'}
            </Button>
          )
        }
      />
      <div className="filter-tabs" role="tablist" aria-label="Bandejas">
        {BANDEJAS.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={bandeja === b.id}
            className={bandeja === b.id ? 'active' : ''}
            onClick={() => {
              setBandeja(b.id)
              setSeleccion(null)
            }}
          >
            {b.label} {resumen.data ? resumen.data[b.id] : ''}
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 9, margin: '-4px 0 14px' }}>
        {info.ayuda}
      </p>
      {procesar.error && <ErrorNotice message={procesar.error} />}
      {loading && !data && <Loading />}
      {error && <ErrorNotice message={error} onRetry={reload} />}
      {data && lista.length === 0 && (
        <EmptyState icon="check" title={`No hay evidencias en “${info.label}”`}>
          Las fotos que se suben desde la app o el panel pasan por la moderación automática y llegan aquí para revisión.
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
          <Moderacion key={actual.id} evidence={actual} onDone={recargar} />
        </div>
      )}
    </div>
  )
}

function Moderacion({ evidence, onDone }: { evidence: Evidence; onDone: () => void }) {
  const { farms } = useActiveFarm()
  const { mutate, saving, error } = useApiMutation()
  const [motivo, setMotivo] = useState('')
  const [publica, setPublica] = useState(false)
  const score = toNumber(evidence.moderationScore)
  const finca = farms.find((f) => f.id === evidence.farmId)

  async function moderar(status: EvidenceStatus) {
    const ok = await mutate(`/evidence/${evidence.id}/moderation`, 'PATCH', {
      status,
      rejectionReason: motivo.trim() || undefined,
      visibility: status === 'APROBADA' && publica ? 'PUBLICA' : undefined,
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
            {evidence.moderationEngine && ` · ${evidence.moderationEngine.replace('+', ' + ').replace('GOOGLE_VISION', 'Google Vision')}`}
          </dd>
        </div>
      </dl>
      {score !== null && (
        <p className="muted" style={{ fontSize: 8, marginBottom: 10 }}>
          El puntaje es la probabilidad de contenido inapropiado: 0 es limpio, 100 es casi seguro inapropiado.
        </p>
      )}
      <label className="field">
        <span>Motivo u observación</span>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Obligatorio para rechazar. Escribe una observación clara..." />
      </label>
      <label className="check-row">
        <input type="checkbox" checked={publica} onChange={(e) => setPublica(e.target.checked)} />
        <span>
          <strong>Autorizar para el portal público</strong>
          <small>Al aprobarla podrá aparecer en las publicaciones de la finca. Nunca se publica su ubicación exacta.</small>
        </span>
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
