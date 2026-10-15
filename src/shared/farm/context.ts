import { createContext, useContext } from 'react'
import type { Farm } from '../api/types'

export type ActiveFarm = {
  farms: Farm[]
  farm: Farm | null
  setFarmId: (id: string) => void
  loading: boolean
  error: string | null
  reload: () => void
}

export const ActiveFarmContext = createContext<ActiveFarm | null>(null)

/** Finca seleccionada en la barra superior; las vistas por finca la usan. */
export function useActiveFarm(): ActiveFarm {
  const value = useContext(ActiveFarmContext)
  if (!value) throw new Error('useActiveFarm debe usarse dentro de ActiveFarmProvider')
  return value
}
