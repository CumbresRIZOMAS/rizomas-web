import type { Labor } from '../../shared/api/types'
import { LABOR_TYPE_LABEL, MANAGEMENT_TYPE_LABEL, formatNumber } from '../../shared/format'
import type { ChipTone, IconName } from '../../shared/ui'

export function laborIcon(labor: Pick<Labor, 'type'>): IconName {
  switch (labor.type) {
    case 'COSECHA':
      return 'coffee'
    case 'SIEMBRA':
      return 'leaf'
    case 'APLICACION_BIOINSUMO':
      return 'drop'
    case 'COMPRA':
    case 'VENTA':
      return 'wallet'
    case 'PROCESO_CAFE':
      return 'process'
    default:
      return 'tool'
  }
}

export function laborTone(labor: Pick<Labor, 'type'>): ChipTone {
  switch (labor.type) {
    case 'COSECHA':
      return 'coffee'
    case 'APLICACION_BIOINSUMO':
      return 'amber'
    case 'SIEMBRA':
      return 'green'
    case 'MANEJO_AGRONOMICO':
      return 'green'
    default:
      return 'blue'
  }
}

/** "Manejo agronómico · Poda" o "Cosecha · 680 kg". */
export function laborKind(labor: Labor): string {
  const base = LABOR_TYPE_LABEL[labor.type]
  if (labor.harvest) return `${base} · ${formatNumber(labor.harvest.quantity)} ${labor.harvest.unit}`
  if (labor.management) return `${base} · ${MANAGEMENT_TYPE_LABEL[labor.management.type]}`
  return base
}

/** "Lote Alto · Café Castillo". */
export function laborPlace(labor: Labor, lotName?: (lotId: string) => string | undefined): string {
  if (labor.crop) {
    const lote = labor.crop.lotId ? lotName?.(labor.crop.lotId) : undefined
    return [lote, [labor.crop.species, labor.crop.variety].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
  }
  if (labor.lot) return labor.lot.name
  return '—'
}
