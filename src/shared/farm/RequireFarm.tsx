import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Farm } from '../api/types'
import { EmptyState, ErrorNotice, Loading } from '../ui'
import { useActiveFarm } from './context'

/** Renderiza la vista con la finca activa, o el estado de carga / vacío. */
export function RequireFarm({ children }: { children: (farm: Farm) => ReactNode }) {
  const { farm, loading, error, reload } = useActiveFarm()
  if (loading) return <Loading />
  if (error && !farm) return <ErrorNotice message={error} onRetry={reload} />
  if (!farm)
    return (
      <EmptyState
        icon="farm"
        title="Todavía no hay fincas"
        action={
          <Link className="btn btn-primary" to="/fincas">
            Registrar finca
          </Link>
        }
      >
        Registra una finca para empezar a cargar lotes, labores y análisis.
      </EmptyState>
    )
  return <>{children(farm)}</>
}
