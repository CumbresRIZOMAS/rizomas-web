import { useState } from 'react'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { PhotoCandidate } from '../../shared/api/types'
import { EvidencePhoto } from '../../shared/EvidencePhoto'
import { formatDate } from '../../shared/format'
import { Button, Empty, ErrorNotice, Icon, Loading } from '../../shared/ui'

/**
 * Elegir qué fotos acompañan una publicación del portal. Solo aparecen las
 * aprobadas en moderación y autorizadas como públicas (ASR-15: sin ubicación).
 */
export function FotosPublicacion({ publicationId, onSaved, onCancel }: { publicationId: string; onSaved: () => void; onCancel: () => void }) {
  const { data, error, loading, reload } = useApiQuery<PhotoCandidate[]>(`/publications/${publicationId}/photo-candidates`)
  const guardar = useApiMutation()
  const [elegidas, setElegidas] = useState<Set<string> | null>(null)
  const seleccion = elegidas ?? new Set((data ?? []).filter((c) => c.linked).map((c) => c.id))

  function alternar(id: string) {
    const nueva = new Set(seleccion)
    if (nueva.has(id)) nueva.delete(id)
    else if (nueva.size < 12) nueva.add(id)
    setElegidas(nueva)
  }

  async function onGuardar() {
    if ((await guardar.mutate(`/publications/${publicationId}/evidences`, 'PUT', { evidenceIds: [...seleccion] })) !== null) onSaved()
  }

  return (
    <div className="rec-form" aria-label="Fotos de la publicación">
      {loading && !data && <Loading />}
      {error && <ErrorNotice message={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <Empty title="No hay fotos disponibles">
          Aprueba fotos en Evidencias marcando “Autorizar para el portal público” y aparecerán aquí.
        </Empty>
      )}
      {data && data.length > 0 && (
        <>
          <p className="muted" style={{ fontSize: 9 }}>
            Elige hasta 12 fotos. {seleccion.size} {seleccion.size === 1 ? 'elegida' : 'elegidas'}.
          </p>
          <div className="photo-grid">
            {data.map((c) => (
              <button
                type="button"
                key={c.id}
                aria-pressed={seleccion.has(c.id)}
                className={`photo-card ${seleccion.has(c.id) ? 'selected' : ''}`}
                onClick={() => alternar(c.id)}
              >
                <div className="photo-art">
                  <EvidencePhoto objectKey={c.objectKey} alt={`Foto del ${formatDate(c.capturedAt)}`} />
                </div>
                {seleccion.has(c.id) && (
                  <span className="chip chip-green">
                    <Icon name="check" size={12} /> Elegida
                  </span>
                )}
                <div>
                  <strong>{c.laborId ? 'Foto de labor' : 'Foto de la finca'}</strong>
                  <span>{formatDate(c.capturedAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      {guardar.error && <ErrorNotice message={guardar.error} />}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button icon="check" disabled={guardar.saving || !data} onClick={() => void onGuardar()}>
          {guardar.saving ? 'Guardando…' : 'Guardar fotos'}
        </Button>
      </div>
    </div>
  )
}
