import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useApiQuery } from '../../shared/api/hooks'
import type { Farm } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { FARM_TYPE_LABEL, formatHa } from '../../shared/format'
import { Empty, ErrorNotice, Loading, PageHeader } from '../../shared/ui'
import { FincaForm } from './FincaForm'

export function FincasPage() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const { data: fincas, error, loading, reload } = useApiQuery<Farm[]>('/farms')
  const [creando, setCreando] = useState(false)

  return (
    <>
      <PageHeader
        eyebrow="Gestión"
        title="Fincas"
        subtitle="Fincas registradas, con sus lotes y labores."
        actions={
          canDo(role, ROLES.crearFinca) &&
          !creando && (
            <button type="button" className="btn btn-primary" onClick={() => setCreando(true)}>
              + Nueva finca
            </button>
          )
        }
      />

      <div className="stack">
        {creando && (
          <FincaForm
            title="Nueva finca"
            onCancel={() => setCreando(false)}
            onSaved={(finca) => {
              setCreando(false)
              navigate(`/fincas/${finca.id}`)
            }}
          />
        )}

        {loading && !fincas && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {fincas && fincas.length === 0 && (
          <div className="card">
            <Empty title="Todavía no hay fincas">Registra la primera para empezar a cargar lotes y labores.</Empty>
          </div>
        )}
        {fincas && fincas.length > 0 && (
          <div className="grid grid-cards">
            {fincas.map((f) => (
              <Link key={f.id} to={`/fincas/${f.id}`} className="card farm-card">
                <h3>{f.name}</h3>
                <p className="meta">{[f.municipality, f.region].filter(Boolean).join(', ') || 'Sin ubicación registrada'}</p>
                <div className="tags">
                  <span className="tag tag-green">{f.lots?.length ?? 0} lotes</span>
                  <span className="tag">{formatHa(f.areaHa)}</span>
                  <span className="tag tag-earth">{FARM_TYPE_LABEL[f.farmType]}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
