import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import type { FarmType } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { useActiveFarm } from '../../shared/farm/context'
import { FARM_TYPE_LABEL, FARM_TYPE_TONE, formatHa } from '../../shared/format'
import { Button, Card, Chip, Empty, ErrorNotice, Icon, Loading, PageHeader } from '../../shared/ui'
import { FincaForm } from './FincaForm'

const POR_PAGINA = 10

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function FincasPage() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const { farms, loading, error, reload, setFarmId } = useActiveFarm()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [tipo, setTipo] = useState<FarmType | ''>('')
  const [region, setRegion] = useState('')
  const [pagina, setPagina] = useState(0)
  const [creando, setCreando] = useState(false)

  const regiones = [...new Set(farms.map((f) => f.region).filter((r): r is string => Boolean(r)))].sort()
  const filtradas = farms.filter((f) => {
    const texto = normalizar([f.name, f.municipality, f.region, f.owner?.name].filter(Boolean).join(' '))
    return (!q || texto.includes(normalizar(q))) && (!tipo || f.farmType === tipo) && (!region || f.region === region)
  })
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const actual = Math.min(pagina, paginas - 1)
  const visibles = filtradas.slice(actual * POR_PAGINA, (actual + 1) * POR_PAGINA)

  function setQ(value: string) {
    setPagina(0)
    setParams(value ? { q: value } : {}, { replace: true })
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        title="Fincas"
        subtitle="Consulta y administra las fincas vinculadas a Cumbres Sacras SAS."
        actions={
          canDo(role, ROLES.crearFinca) &&
          !creando && (
            <Button icon="plus" onClick={() => setCreando(true)}>
              Registrar finca
            </Button>
          )
        }
      />
      <div className="stack">
        {creando && (
          <FincaForm
            title="Registrar finca"
            onCancel={() => setCreando(false)}
            onSaved={(finca) => {
              setCreando(false)
              reload()
              setFarmId(finca.id)
              navigate(`/fincas/${finca.id}`)
            }}
          />
        )}
        <Card>
          <div className="filter-bar">
            <div className="search-field">
              <Icon name="search" size={18} />
              <input aria-label="Buscar finca" placeholder="Buscar por nombre, municipio o propietario" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <label className="field">
              <select aria-label="Tipo de finca" value={tipo} onChange={(e) => setTipo(e.target.value as FarmType | '')}>
                <option value="">Todos los tipos</option>
                {Object.entries(FARM_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <select aria-label="Región" value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">Todas las regiones</option>
                {regiones.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>
          {loading && <Loading />}
          {error && <ErrorNotice message={error} onRetry={reload} />}
          {!loading && farms.length === 0 && <Empty title="Todavía no hay fincas">Registra la primera para empezar a cargar lotes y labores.</Empty>}
          {farms.length > 0 && filtradas.length === 0 && <Empty title="Ninguna finca coincide con la búsqueda" />}
          {visibles.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {['Finca', 'Ubicación', 'Área', 'Clima', 'Tipo de finca', 'Lotes', 'Propietario', ''].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <Link className="table-name" to={`/fincas/${f.id}`}>
                          {f.name}
                        </Link>
                      </td>
                      <td>
                        <span className="cell-icon">
                          <Icon name="location" size={15} />
                          {[f.municipality, f.region].filter(Boolean).join(', ') || 'Sin ubicación'}
                        </span>
                      </td>
                      <td>{formatHa(f.areaHa)}</td>
                      <td>{f.climate ?? '—'}</td>
                      <td>
                        <Chip tone={FARM_TYPE_TONE[f.farmType]}>{FARM_TYPE_LABEL[f.farmType]}</Chip>
                      </td>
                      <td>{f.lots?.length ?? 0}</td>
                      <td>{f.owner?.name ?? '—'}</td>
                      <td>
                        <Link className="icon-button" to={`/fincas/${f.id}`} aria-label={`Ver ${f.name}`}>
                          <Icon name="arrow" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filtradas.length > 0 && (
            <div className="table-footer">
              <span>
                Mostrando {visibles.length} de {filtradas.length} {filtradas.length === 1 ? 'finca' : 'fincas'}
              </span>
              <div>
                <Button variant="ghost" disabled={actual === 0} onClick={() => setPagina(actual - 1)}>
                  Anterior
                </Button>
                <Button variant="secondary" disabled={actual >= paginas - 1} onClick={() => setPagina(actual + 1)}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
