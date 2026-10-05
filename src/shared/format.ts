import type { AgronomicManagementType, Decimal, FarmType, LaborType } from './api/types'

const fecha = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const numero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

/** "5 sept 2026". Las fechas de labores se guardan a medianoche UTC. */
export function formatDate(iso: string | null | undefined): string {
  return iso ? fecha.format(new Date(iso)) : '—'
}

export function toNumber(value: Decimal | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function formatNumber(value: Decimal | null | undefined): string {
  const n = toNumber(value)
  return n === null ? '—' : numero.format(n)
}

export function formatHa(value: Decimal | null | undefined): string {
  const n = toNumber(value)
  return n === null ? 'Sin área' : `${numero.format(n)} ha`
}

export const FARM_TYPE_LABEL: Record<FarmType, string> = {
  CONVENCIONAL: 'Convencional',
  EN_TRANSICION: 'En transición',
  REGENERATIVA: 'Regenerativa',
}

export const LABOR_TYPE_LABEL: Record<LaborType, string> = {
  SIEMBRA: 'Siembra',
  COSECHA: 'Cosecha',
  COMPRA: 'Compra',
  VENTA: 'Venta',
  MANEJO_AGRONOMICO: 'Manejo agronómico',
  APLICACION_BIOINSUMO: 'Aplicación de bioinsumo',
  PROCESO_CAFE: 'Proceso de café',
  OTRO: 'Otra',
}

export const MANAGEMENT_TYPE_LABEL: Record<AgronomicManagementType, string> = {
  LIMPIEZA: 'Limpieza',
  PODA: 'Poda',
  ABONO: 'Abono',
  REVISION: 'Revisión',
  RIEGO: 'Riego',
  FERTILIZACION: 'Fertilización',
  CONTROL_PLAGAS: 'Control de plagas',
  OTRO: 'Otro',
}

/** Convierte el texto de un campo numérico ("1,5") en número, o undefined si está vacío. */
export function parseOptionalNumber(text: string): number | undefined {
  const limpio = text.trim().replace(',', '.')
  if (!limpio) return undefined
  const n = Number(limpio)
  return Number.isFinite(n) ? n : undefined
}

/** Texto opcional: vacío → undefined, para no mandar "" al backend. */
export function optionalText(text: string): string | undefined {
  const limpio = text.trim()
  return limpio ? limpio : undefined
}
