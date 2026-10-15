import type { Labor } from '../../shared/api/types'
import { formatDate, formatShortDate } from '../../shared/format'
import { Card, Chip, Empty, Icon } from '../../shared/ui'
import { laborIcon, laborKind, laborPlace, laborTone } from './laborVisual'

/** Historial de labores en forma de línea de tiempo (diseño "Historial de labores"). */
export function LaborTimeline({ labors, lotName }: { labors: Labor[]; lotName: (id: string) => string | undefined }) {
  if (labors.length === 0)
    return (
      <Card>
        <Empty title="Sin labores registradas">Las labores registradas desde la app o el panel aparecen aquí.</Empty>
      </Card>
    )
  return (
    <div className="timeline">
      {labors.map((l) => (
        <div className="timeline-row" key={l.id}>
          <div className="timeline-date">{formatShortDate(l.startDate).toUpperCase()}</div>
          <div className="timeline-dot" />
          <Card>
            <div className="timeline-main">
              <div className={`activity-icon ${laborTone(l)}`}>
                <Icon name={laborIcon(l)} />
              </div>
              <div>
                <div className="title-line">
                  <h3>{l.name}</h3>
                  <Chip tone={laborTone(l)}>{laborKind(l)}</Chip>
                </div>
                <p>{laborPlace(l, lotName)}</p>
                <small>
                  {l.endDate && l.endDate !== l.startDate ? `Del ${formatDate(l.startDate)} al ${formatDate(l.endDate)}` : formatDate(l.startDate)}
                  {l.observations && ` · ${l.observations}`}
                </small>
              </div>
            </div>
          </Card>
        </div>
      ))}
    </div>
  )
}
