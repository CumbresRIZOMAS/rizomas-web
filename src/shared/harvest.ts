import type { Labor } from './api/types'
import { toNumber } from './format'

/** Labores de cosecha con su cantidad (las que no la tienen se ignoran). */
export function harvests(labors: Labor[]) {
  return labors.flatMap((l) => {
    const quantity = l.harvest ? toNumber(l.harvest.quantity) : null
    return l.type === 'COSECHA' && l.harvest && quantity !== null ? [{ labor: l, quantity, unit: l.harvest.unit }] : []
  })
}

/** Unidad más usada en las cosechas; los totales solo suman esa unidad para no mezclar kg con arrobas. */
export function mainUnit(labors: Labor[]): string {
  const counts = new Map<string, number>()
  for (const h of harvests(labors)) counts.set(h.unit, (counts.get(h.unit) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'kg'
}

export function harvestTotal(labors: Labor[], unit: string, from?: Date, to?: Date): number {
  return harvests(labors)
    .filter((h) => h.unit === unit)
    .filter((h) => {
      const d = new Date(h.labor.startDate)
      return (!from || d >= from) && (!to || d <= to)
    })
    .reduce((sum, h) => sum + h.quantity, 0)
}

/** Cantidad cosechada por mes (0-11) de un año, en la unidad indicada. */
export function harvestByMonth(labors: Labor[], year: number, unit: string): number[] {
  const months = Array<number>(12).fill(0)
  for (const h of harvests(labors)) {
    const d = new Date(h.labor.startDate)
    if (h.unit === unit && d.getUTCFullYear() === year) months[d.getUTCMonth()] += h.quantity
  }
  return months
}

export function harvestYears(labors: Labor[]): number[] {
  const years = new Set(harvests(labors).map((h) => new Date(h.labor.startDate).getUTCFullYear()))
  years.add(new Date().getFullYear())
  return [...years].sort((a, b) => b - a)
}
