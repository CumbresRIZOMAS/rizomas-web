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

const fechaCorta = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', timeZone: 'UTC' })
const fechaLarga = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

/** "18 jun" (fechas de timeline y listas). */
export function formatShortDate(iso: string | null | undefined): string {
  return iso ? fechaCorta.format(new Date(iso)).replace(' de ', ' ').replace('.', '') : '—'
}

/** "18 de junio de 2025". */
export function formatLongDate(iso: string | Date | null | undefined): string {
  return iso ? fechaLarga.format(typeof iso === 'string' ? new Date(iso) : iso) : '—'
}

export function formatMoney(value: Decimal | null | undefined): string {
  const n = toNumber(value)
  return n === null ? '—' : pesos.format(n)
}

/** "$ 7,8 M" para KPIs. */
export function formatMoneyShort(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$ ${numero.format(Math.round(value / 100_000) / 10)} M`
  return pesos.format(value)
}

export const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export const ROLE_LABEL: Record<string, string> = {
  ADMIN_CUMBRES: 'Administrador de empresa',
  ADMIN_FINCA: 'Administrador de finca',
  TECNICO: 'Técnico',
  AGRICULTOR: 'Agricultor',
  CLIENTE: 'Cliente',
  PROVEEDOR: 'Proveedor',
  COMPRADOR_CERTIFICADORA: 'Comprador / certificadora',
  PUBLICO: 'Público',
}

export const FARM_TYPE_TONE: Record<FarmType, 'green' | 'amber' | 'gray'> = {
  REGENERATIVA: 'green',
  EN_TRANSICION: 'amber',
  CONVENCIONAL: 'gray',
}

export const DIAGNOSIS_LABEL: Record<string, { label: string; tone: 'green' | 'blue' | 'terra' | 'gray' }> = {
  OPTIMO: { label: 'Óptimo', tone: 'green' },
  BAJO: { label: 'Bajo', tone: 'blue' },
  ALTO: { label: 'Alto', tone: 'terra' },
  SIN_REFERENCIA: { label: 'Sin referencia', tone: 'gray' },
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
