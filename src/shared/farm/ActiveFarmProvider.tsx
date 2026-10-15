import { useMemo, useState, type ReactNode } from 'react'
import { useApiQuery } from '../api/hooks'
import type { Farm } from '../api/types'
import { ActiveFarmContext, type ActiveFarm } from './context'

const STORAGE_KEY = 'rizomas.fincaActiva'

function leerGuardada(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function ActiveFarmProvider({ children }: { children: ReactNode }) {
  const { data, error, loading, reload } = useApiQuery<Farm[]>('/farms')
  const [farmId, setFarmIdState] = useState<string | null>(leerGuardada)

  const value = useMemo<ActiveFarm>(() => {
    const farms = data ?? []
    // Si la guardada ya no existe (o no hay ninguna), se usa la primera.
    const farm = farms.find((f) => f.id === farmId) ?? farms[0] ?? null
    return {
      farms,
      farm,
      setFarmId: (id) => {
        setFarmIdState(id)
        try {
          localStorage.setItem(STORAGE_KEY, id)
        } catch {
          // Sin almacenamiento (modo privado): la selección dura lo que dure la pestaña.
        }
      },
      loading: loading && !data,
      error,
      reload,
    }
  }, [data, error, loading, reload, farmId])

  return <ActiveFarmContext.Provider value={value}>{children}</ActiveFarmContext.Provider>
}
