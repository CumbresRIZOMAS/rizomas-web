import type { CoffeeProcess } from '../../shared/api/types'
import type { IconName } from '../../shared/ui'

/** Etapas del beneficio y transformación del café (RF-14), en orden. */
export const ETAPAS: { nombre: string; icon: IconName }[] = [
  { nombre: 'Cosecha', icon: 'coffee' },
  { nombre: 'Despulpado', icon: 'process' },
  { nombre: 'Fermentación', icon: 'process' },
  { nombre: 'Lavado', icon: 'drop' },
  { nombre: 'Secado', icon: 'process' },
  { nombre: 'Trilla', icon: 'process' },
  { nombre: 'Almacenamiento', icon: 'farm' },
  { nombre: 'Tostión', icon: 'coffee' },
  { nombre: 'Catación', icon: 'coffee' },
]

function clave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Índice de la etapa actual; -1 si el texto guardado no coincide con ninguna. */
export function etapaIndex(proceso: Pick<CoffeeProcess, 'currentStage'>): number {
  const valor = clave(proceso.currentStage)
  const actual = valor === 'tostado' ? 'tostion' : valor === 'beneficio' ? 'despulpado' : valor
  return ETAPAS.findIndex((e) => clave(e.nombre) === actual)
}

export function codigoProceso(p: Pick<CoffeeProcess, 'id' | 'startedAt'>): string {
  return `CP-${new Date(p.startedAt).getUTCFullYear()}-${p.id.slice(0, 4).toUpperCase()}`
}
