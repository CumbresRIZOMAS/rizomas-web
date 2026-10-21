import { useEffect, useMemo, useState } from 'react'

const GEOJSON_URL = 'https://raw.githubusercontent.com/ytolosa/mapas-colombia/main/output/geojson/col_departamentos_inset_nacional.geojson'
const WIDTH = 600
const HEIGHT = 650
const PADDING = 22

type Position = [number, number]
type Geometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: Position[][] | Position[][][] }
type DepartmentFeature = { type: 'Feature'; properties: { dpto_nombre?: string }; geometry: Geometry }
type FeatureCollection = { type: 'FeatureCollection'; features: DepartmentFeature[] }
type Shape = { name: string; d: string; bounds: [number, number, number, number] }

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleUpperCase('es')
}

function ringsOf(geometry: Geometry): Position[][] {
  return geometry.type === 'Polygon'
    ? geometry.coordinates as Position[][]
    : (geometry.coordinates as Position[][][]).flat()
}

export function ColombiaDepartmentsMap({
  region,
  onSelect,
  counts,
}: {
  region: string
  onSelect: (department: string) => void
  counts: Record<string, number>
}) {
  const [features, setFeatures] = useState<DepartmentFeature[]>([])
  const [error, setError] = useState(false)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const controller = new AbortController()
    fetch(GEOJSON_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('No se pudo cargar el mapa')
        return response.json() as Promise<FeatureCollection>
      })
      .then((data) => setFeatures(data.features ?? []))
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(true)
      })
    return () => controller.abort()
  }, [])

  const shapes = useMemo(() => {
    if (!features.length) return []
    const positions = features.flatMap((feature) => ringsOf(feature.geometry).flat())
    const minLon = Math.min(...positions.map(([lon]) => lon))
    const maxLon = Math.max(...positions.map(([lon]) => lon))
    const minLat = Math.min(...positions.map(([, lat]) => lat))
    const maxLat = Math.max(...positions.map(([, lat]) => lat))
    const scale = Math.min((WIDTH - PADDING * 2) / (maxLon - minLon), (HEIGHT - PADDING * 2) / (maxLat - minLat))
    const mapWidth = (maxLon - minLon) * scale
    const mapHeight = (maxLat - minLat) * scale
    const offsetX = (WIDTH - mapWidth) / 2
    const offsetY = (HEIGHT - mapHeight) / 2
    const project = ([lon, lat]: Position): Position => [offsetX + (lon - minLon) * scale, offsetY + (maxLat - lat) * scale]

    return features.map((feature): Shape => {
      const rings = ringsOf(feature.geometry)
      const projected = rings.map((ring) => ring.map(project))
      const all = projected.flat()
      const xs = all.map(([x]) => x)
      const ys = all.map(([, y]) => y)
      const bounds: Shape['bounds'] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
      const d = projected.map((ring) => `${ring.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')}Z`).join('')
      return { name: feature.properties.dpto_nombre ?? 'Departamento', d, bounds }
    })
  }, [features])

  const selected = shapes.find((shape) => normalize(shape.name) === normalize(region))
  const centerX = selected && zoom > 1 ? (selected.bounds[0] + selected.bounds[2]) / 2 : WIDTH / 2
  const centerY = selected && zoom > 1 ? (selected.bounds[1] + selected.bounds[3]) / 2 : HEIGHT / 2
  const viewWidth = WIDTH / zoom
  const viewHeight = HEIGHT / zoom
  const viewBox = `${centerX - viewWidth / 2} ${centerY - viewHeight / 2} ${viewWidth} ${viewHeight}`

  return (
    <div className="department-map" aria-label="Mapa interactivo de los departamentos de Colombia">
      {shapes.length > 0 ? (
        <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Selecciona un departamento">
          <g className="department-shapes">
            {shapes.map((shape) => {
              const active = normalize(shape.name) === normalize(region)
              const count = counts[normalize(shape.name)] ?? 0
              return (
                <path
                  key={shape.name}
                  d={shape.d}
                  className={`department-shape${active ? ' selected' : ''}${count ? ' has-origins' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${shape.name}: ${count} ${count === 1 ? 'finca' : 'fincas'}`}
                  aria-pressed={active}
                  onClick={() => onSelect(active ? '' : shape.name)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelect(active ? '' : shape.name)
                    }
                  }}
                >
                  <title>{shape.name} · {count} {count === 1 ? 'finca' : 'fincas'}</title>
                </path>
              )
            })}
          </g>
        </svg>
      ) : (
        <p className="department-map-status">{error ? 'No se pudo cargar el mapa de departamentos.' : 'Cargando mapa de Colombia…'}</p>
      )}
      <div className="department-map-caption">
        <span><i /> Departamentos con fincas</span>
        <span>Cartografía: DANE, MGN 2025. Simplificación: mapas-colombia (CC BY 4.0).</span>
      </div>
      <div className="department-map-controls" aria-label="Controles del mapa">
        <button type="button" aria-label="Ampliar mapa" title="Ampliar" disabled={zoom >= 4} onClick={() => setZoom((value) => Math.min(4, value + 0.5))}>+</button>
        <button type="button" aria-label="Reducir mapa" title="Reducir" disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - 0.5))}>−</button>
        <button type="button" aria-label="Mostrar Colombia completa" title="Mostrar Colombia completa" onClick={() => { setZoom(1); onSelect('') }}>Colombia</button>
      </div>
    </div>
  )
}
