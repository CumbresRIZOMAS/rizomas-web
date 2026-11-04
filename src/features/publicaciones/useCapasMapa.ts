import type { ExpressionSpecification, Map as MapaGL, MapGeoJSONFeature } from 'maplibre-gl'
import { useEffect, useRef, type RefObject } from 'react'
import {
  BASE_DATOS,
  COLOR_CAPA,
  COLOR_DOP,
  DENOMINACIONES,
  ESCALA_PRODUCCION,
  centroPoligono,
  granCirculo,
  type CafeDatos,
  type CapaId,
  type Contexto,
  type DopId,
  type MunicipioCafe,
} from './capasMapa'
import type { Idioma } from './origenesMapa'

type Coleccion = { type: 'FeatureCollection'; features: { type: 'Feature'; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[] }

const cache = new Map<string, Promise<unknown>>()

/** Descarga (una sola vez) un archivo de public/mapa. */
export function cargarDatos<T>(archivo: string): Promise<T> {
  if (!cache.has(archivo)) {
    const promesa = fetch(`${BASE_DATOS}/${archivo}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`No se pudo cargar ${archivo}`))))
    promesa.catch(() => cache.delete(archivo))
    cache.set(archivo, promesa)
  }
  return cache.get(archivo) as Promise<T>
}

// Orden de dibujo (de abajo hacia arriba) y prioridad de clic (de arriba hacia abajo).
const ORDEN: CapaId[] = ['produccion', 'denominaciones', 'pcc', 'protegidas', 'paramos', 'rios', 'puertos', 'destinos']
const CAPAS_DE: Record<CapaId, string[]> = {
  produccion: ['rz-produccion-relleno', 'rz-produccion-borde', 'rz-produccion-sel'],
  denominaciones: ['rz-dop-relleno', 'rz-dop-borde', 'rz-dop-etiqueta'],
  pcc: ['rz-pcc-relleno', 'rz-pcc-borde', 'rz-pcc-etiqueta'],
  protegidas: ['rz-prot-relleno', 'rz-prot-borde', 'rz-prot-puntos', 'rz-prot-etiqueta'],
  paramos: ['rz-paramos-relleno', 'rz-paramos-borde', 'rz-paramos-etiqueta'],
  rios: ['rz-rios-linea', 'rz-rios-toque', 'rz-rios-etiqueta'],
  puertos: ['rz-puertos-circulo', 'rz-puertos-etiqueta'],
  destinos: ['rz-destinos-arcos', 'rz-destinos-circulo', 'rz-destinos-etiqueta'],
}
const FUENTES_DE: Record<CapaId, string[]> = {
  produccion: ['rz-src-produccion'],
  denominaciones: ['rz-src-dop', 'rz-src-dop-etq'],
  pcc: ['rz-src-pcc', 'rz-src-pcc-etq'],
  protegidas: ['rz-src-prot', 'rz-src-prot-pts'],
  paramos: ['rz-src-paramos'],
  rios: ['rz-src-rios'],
  puertos: ['rz-src-puertos'],
  destinos: ['rz-src-arcos', 'rz-src-destinos'],
}
const CLIC: string[] = ['rz-puertos-circulo', 'rz-destinos-circulo', 'rz-prot-puntos', 'rz-paramos-relleno', 'rz-prot-relleno', 'rz-produccion-relleno', 'rz-pcc-relleno', 'rz-dop-relleno', 'rz-rios-toque']

const FUENTE_TEXTO = ['Noto Sans Regular']
const FUENTE_NEGRITA = ['Noto Sans Bold']
const FUENTE_CURSIVA = ['Noto Sans Italic']
// Origen de los arcos: el eje cafetero.
const ORIGEN_ARCOS: [number, number] = [-75.6, 4.8]
const DASH = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
]

function antesDe(mapa: MapaGL, capa: CapaId): string | undefined {
  // Se inserta debajo de la primera capa propia que deba quedar encima…
  for (const siguiente of ORDEN.slice(ORDEN.indexOf(capa) + 1)) {
    const id = CAPAS_DE[siguiente].find((l) => mapa.getLayer(l))
    if (id) return id
  }
  // …o debajo de las etiquetas del mapa base.
  return mapa.getStyle().layers?.find((l) => l.type === 'symbol' && !l.id.startsWith('rz-'))?.id
}

const opacidadPorZoom = (inicio: number, fin: number): ExpressionSpecification => ['interpolate', ['linear'], ['zoom'], 4, inicio, 9, (inicio + fin) / 2, 12.5, fin]

function puntosDe(datos: Coleccion, props: (p: Record<string, unknown>) => Record<string, unknown>): Coleccion {
  return {
    type: 'FeatureCollection',
    features: datos.features.map((f) => ({
      type: 'Feature',
      properties: props(f.properties),
      geometry: { type: 'Point', coordinates: centroPoligono(f.geometry as Parameters<typeof centroPoligono>[0]) },
    })),
  }
}

async function agregar(mapa: MapaGL, capa: CapaId, idioma: Idioma, sigueActiva: () => boolean) {
  const listo = () => sigueActiva()
  const etiqueta = (color: string) => ({ 'text-color': '#ffffff', 'text-halo-color': color, 'text-halo-width': 1.6 })
  switch (capa) {
    case 'produccion': {
      const datos = await cargarDatos<Coleccion>('cafe-municipios.geojson')
      if (!listo() || mapa.getSource('rz-src-produccion')) return
      mapa.addSource('rz-src-produccion', { type: 'geojson', data: datos as never })
      const colores = ESCALA_PRODUCCION.flatMap(([t, c]) => [t, c])
      const antes = antesDe(mapa, capa)
      mapa.addLayer({ id: 'rz-produccion-relleno', type: 'fill', source: 'rz-src-produccion', paint: { 'fill-color': ['interpolate', ['linear'], ['get', 't'], ...colores] as ExpressionSpecification, 'fill-opacity': opacidadPorZoom(0.78, 0.18) } }, antes)
      mapa.addLayer({ id: 'rz-produccion-borde', type: 'line', source: 'rz-src-produccion', paint: { 'line-color': '#ffffff', 'line-opacity': 0.35, 'line-width': 0.4 } }, antes)
      mapa.addLayer({ id: 'rz-produccion-sel', type: 'line', source: 'rz-src-produccion', filter: ['==', ['get', 'c'], ''], paint: { 'line-color': '#ffffff', 'line-width': 2.6 } }, antes)
      return
    }
    case 'denominaciones': {
      const datos = await cargarDatos<Coleccion>('denominaciones.geojson')
      if (!listo() || mapa.getSource('rz-src-dop')) return
      mapa.addSource('rz-src-dop', { type: 'geojson', data: datos as never })
      mapa.addSource('rz-src-dop-etq', { type: 'geojson', data: puntosDe(datos, (p) => ({ dop: p.dop, n: DENOMINACIONES[p.dop as DopId]?.nombre ?? '' })) as never })
      const color = ['match', ['get', 'dop'], ...Object.entries(COLOR_DOP).flat(), '#999999'] as unknown as ExpressionSpecification
      const antes = antesDe(mapa, capa)
      mapa.addLayer({ id: 'rz-dop-relleno', type: 'fill', source: 'rz-src-dop', paint: { 'fill-color': color, 'fill-opacity': opacidadPorZoom(0.38, 0.06) } }, antes)
      mapa.addLayer({ id: 'rz-dop-borde', type: 'line', source: 'rz-src-dop', paint: { 'line-color': color, 'line-width': 2, 'line-opacity': 0.9 } }, antes)
      mapa.addLayer({ id: 'rz-dop-etiqueta', type: 'symbol', source: 'rz-src-dop-etq', maxzoom: 9.5, layout: { 'text-field': ['get', 'n'], 'text-font': FUENTE_NEGRITA, 'text-size': 13 }, paint: { ...etiqueta('#3b2a1a') } })
      return
    }
    case 'pcc': {
      const datos = await cargarDatos<Coleccion>('paisaje-cultural-cafetero.geojson')
      if (!listo() || mapa.getSource('rz-src-pcc')) return
      mapa.addSource('rz-src-pcc', { type: 'geojson', data: datos as never })
      mapa.addSource('rz-src-pcc-etq', { type: 'geojson', data: puntosDe(datos, () => ({ n: idioma === 'es' ? 'Paisaje Cultural Cafetero' : 'Coffee Cultural Landscape' })) as never })
      const antes = antesDe(mapa, capa)
      mapa.addLayer({ id: 'rz-pcc-relleno', type: 'fill', source: 'rz-src-pcc', paint: { 'fill-color': COLOR_CAPA.pcc, 'fill-opacity': opacidadPorZoom(0.3, 0.08) } }, antes)
      mapa.addLayer({ id: 'rz-pcc-borde', type: 'line', source: 'rz-src-pcc', paint: { 'line-color': COLOR_CAPA.pcc, 'line-width': 2.6, 'line-dasharray': [2, 1.2] } }, antes)
      mapa.addLayer({ id: 'rz-pcc-etiqueta', type: 'symbol', source: 'rz-src-pcc-etq', maxzoom: 10, layout: { 'text-field': ['get', 'n'], 'text-font': FUENTE_NEGRITA, 'text-size': 13 }, paint: { ...etiqueta('#6b4c12') } })
      return
    }
    case 'protegidas': {
      const [poligonos, puntos] = await Promise.all([cargarDatos<Coleccion>('areas-protegidas.geojson'), cargarDatos<Coleccion>('areas-protegidas-puntos.geojson')])
      if (!listo() || mapa.getSource('rz-src-prot')) return
      mapa.addSource('rz-src-prot', { type: 'geojson', data: poligonos as never })
      mapa.addSource('rz-src-prot-pts', { type: 'geojson', data: puntos as never })
      const antes = antesDe(mapa, capa)
      mapa.addLayer({ id: 'rz-prot-relleno', type: 'fill', source: 'rz-src-prot', paint: { 'fill-color': COLOR_CAPA.protegidas, 'fill-opacity': opacidadPorZoom(0.36, 0.2) } }, antes)
      mapa.addLayer({ id: 'rz-prot-borde', type: 'line', source: 'rz-src-prot', paint: { 'line-color': '#2f6b2b', 'line-width': 0.9, 'line-opacity': 0.8 } }, antes)
      mapa.addLayer({
        id: 'rz-prot-puntos',
        type: 'circle',
        source: 'rz-src-prot-pts',
        paint: {
          'circle-color': '#6fbf5f',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 1.6, 8, 3.5, 12, 6],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 0.3, 10, 1.2],
        },
      })
      mapa.addLayer({
        id: 'rz-prot-etiqueta',
        type: 'symbol',
        source: 'rz-src-prot',
        minzoom: 6.5,
        filter: ['==', ['get', 'c'], 'Parque Nacional Natural'],
        layout: { 'text-field': ['get', 'n'], 'text-font': FUENTE_CURSIVA, 'text-size': 11, 'text-max-width': 9 },
        paint: { ...etiqueta('#1f4a1c') },
      })
      return
    }
    case 'paramos': {
      const datos = await cargarDatos<Coleccion>('paramos.geojson')
      if (!listo() || mapa.getSource('rz-src-paramos')) return
      mapa.addSource('rz-src-paramos', { type: 'geojson', data: datos as never })
      const antes = antesDe(mapa, capa)
      mapa.addLayer({ id: 'rz-paramos-relleno', type: 'fill', source: 'rz-src-paramos', paint: { 'fill-color': COLOR_CAPA.paramos, 'fill-opacity': opacidadPorZoom(0.62, 0.35) } }, antes)
      mapa.addLayer({ id: 'rz-paramos-borde', type: 'line', source: 'rz-src-paramos', paint: { 'line-color': '#5d7fbf', 'line-width': 1 } }, antes)
      mapa.addLayer({ id: 'rz-paramos-etiqueta', type: 'symbol', source: 'rz-src-paramos', minzoom: 7, layout: { 'text-field': ['concat', 'Páramo ', ['get', 'n']], 'text-font': FUENTE_CURSIVA, 'text-size': 11, 'text-max-width': 9 }, paint: { ...etiqueta('#33507f') } })
      return
    }
    case 'rios': {
      const datos = await cargarDatos<Coleccion>('rios.geojson')
      if (!listo() || mapa.getSource('rz-src-rios')) return
      mapa.addSource('rz-src-rios', { type: 'geojson', data: datos as never })
      const antes = antesDe(mapa, capa)
      mapa.addLayer({ id: 'rz-rios-linea', type: 'line', source: 'rz-src-rios', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': COLOR_CAPA.rios, 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.2, 8, 2.6, 12, 4] } }, antes)
      mapa.addLayer({ id: 'rz-rios-toque', type: 'line', source: 'rz-src-rios', paint: { 'line-color': '#000000', 'line-opacity': 0, 'line-width': 10 } }, antes)
      mapa.addLayer({
        id: 'rz-rios-etiqueta',
        type: 'symbol',
        source: 'rz-src-rios',
        layout: { 'symbol-placement': 'line', 'text-field': idioma === 'es' ? ['concat', 'Río ', ['get', 'n']] : ['concat', ['get', 'n'], ' River'], 'text-font': FUENTE_CURSIVA, 'text-size': 12, 'symbol-spacing': 320 },
        paint: { ...etiqueta('#1d5d96') },
      })
      return
    }
    case 'puertos': {
      const datos = await cargarDatos<CafeDatos>('cafe-datos.json')
      if (!listo() || mapa.getSource('rz-src-puertos')) return
      const millones = (s: number) => (idioma === 'es' ? `${(s / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M sacos` : `${(s / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}M bags`)
      mapa.addSource('rz-src-puertos', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: datos.exportaciones.puertos.map((p) => ({
            type: 'Feature',
            properties: { n: p.n, s: p.sacos, e: p.sacos >= 100000 ? `${p.n.split(' (')[0]}\n${millones(p.sacos)}` : '' },
            geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          })),
        },
      })
      mapa.addLayer({
        id: 'rz-puertos-circulo',
        type: 'circle',
        source: 'rz-src-puertos',
        paint: { 'circle-color': COLOR_CAPA.puertos, 'circle-opacity': 0.85, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2, 'circle-radius': ['interpolate', ['linear'], ['sqrt', ['get', 's']], 0, 5, 3000, 30] },
      })
      mapa.addLayer({ id: 'rz-puertos-etiqueta', type: 'symbol', source: 'rz-src-puertos', layout: { 'text-field': ['get', 'e'], 'text-font': FUENTE_NEGRITA, 'text-size': 12, 'text-offset': [0, 2.6], 'text-anchor': 'top' }, paint: { ...etiqueta('#5a3d0a') } })
      return
    }
    case 'destinos': {
      const datos = await cargarDatos<CafeDatos>('cafe-datos.json')
      if (!listo() || mapa.getSource('rz-src-arcos')) return
      const destinos = datos.exportaciones.destinos
      mapa.addSource('rz-src-arcos', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: destinos.map((d) => ({ type: 'Feature', properties: { s: d.sacos }, geometry: { type: 'LineString', coordinates: granCirculo(ORIGEN_ARCOS, [d.lng, d.lat]) } })),
        },
      })
      mapa.addSource('rz-src-destinos', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: destinos.map((d) => ({ type: 'Feature', properties: { es: d.es, en: d.en, s: d.sacos, u: d.usd, n: idioma === 'es' ? d.es : d.en }, geometry: { type: 'Point', coordinates: [d.lng, d.lat] } })),
        },
      })
      mapa.addLayer({
        id: 'rz-destinos-arcos',
        type: 'line',
        source: 'rz-src-arcos',
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': COLOR_CAPA.destinos, 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['sqrt', ['get', 's']], 0, 0.8, 2300, 6], 'line-dasharray': DASH[0] },
      })
      mapa.addLayer({
        id: 'rz-destinos-circulo',
        type: 'circle',
        source: 'rz-src-destinos',
        paint: { 'circle-color': COLOR_CAPA.destinos, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5, 'circle-radius': ['interpolate', ['linear'], ['sqrt', ['get', 's']], 0, 3, 2300, 16] },
      })
      mapa.addLayer({
        id: 'rz-destinos-etiqueta',
        type: 'symbol',
        source: 'rz-src-destinos',
        filter: ['>=', ['get', 's'], 180000],
        layout: { 'text-field': ['get', 'n'], 'text-font': FUENTE_TEXTO, 'text-size': 12, 'text-offset': [0, 1.4], 'text-anchor': 'top' },
        paint: { ...etiqueta('#3b2a08') },
      })
      return
    }
  }
}

function quitar(mapa: MapaGL, capa: CapaId) {
  try {
    for (const id of CAPAS_DE[capa]) if (mapa.getLayer(id)) mapa.removeLayer(id)
    for (const id of FUENTES_DE[capa]) if (mapa.getSource(id)) mapa.removeSource(id)
  } catch {
    // El mapa ya se destruyó o cambió de estilo.
  }
}

function contextoDe(f: MapGeoJSONFeature): Contexto | null {
  const p = f.properties as Record<string, unknown>
  switch (f.layer.id) {
    case 'rz-produccion-relleno':
      return { tipo: 'municipio', datos: p as unknown as MunicipioCafe }
    case 'rz-dop-relleno':
      return { tipo: 'dop', id: p.dop as DopId }
    case 'rz-pcc-relleno':
      return { tipo: 'pcc' }
    case 'rz-paramos-relleno':
      return { tipo: 'paramo', nombre: String(p.n), ha: Number(p.ha) || 0, resolucion: p.r ? String(p.r) : null }
    case 'rz-prot-relleno':
    case 'rz-prot-puntos':
      return { tipo: 'protegida', nombre: String(p.n), categoria: String(p.c), ha: Number(p.ha) || 0, organizacion: p.o ? String(p.o) : null, url: p.u ? String(p.u) : null }
    case 'rz-puertos-circulo':
      return { tipo: 'puerto', nombre: String(p.n), sacos: Number(p.s) }
    case 'rz-destinos-circulo':
      return { tipo: 'destino', es: String(p.es), en: String(p.en), sacos: Number(p.s), usd: Number(p.u) }
    case 'rz-rios-toque':
      return { tipo: 'rio', nombre: String(p.n) }
    default:
      return null
  }
}

/**
 * Mantiene en el mapa las capas de contexto activas (se vuelven a poner
 * cuando cambia el estilo base), maneja los clics sobre ellas y la vista de
 * globo para los destinos del café.
 */
export function useCapasMapa({
  mapaRef,
  mapaListo,
  activas,
  idioma,
  municipioSeleccionado,
  onContexto,
  onSalirMundo,
}: {
  mapaRef: RefObject<MapaGL | null>
  mapaListo: boolean
  activas: Set<CapaId>
  idioma: Idioma
  municipioSeleccionado: string | null
  onContexto: (contexto: Contexto | null) => void
  onSalirMundo: () => void
}) {
  const activasRef = useRef(activas)
  const idiomaRef = useRef(idioma)
  const onContextoRef = useRef(onContexto)
  const onSalirMundoRef = useRef(onSalirMundo)
  const enMundoRef = useRef(false)
  useEffect(() => {
    activasRef.current = activas
    idiomaRef.current = idioma
    onContextoRef.current = onContexto
    onSalirMundoRef.current = onSalirMundo
  })

  // Sincroniza capas; también al recargar el estilo (relieve ↔ satélite).
  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa || !mapaListo) return
    const sincronizar = () => {
      for (const capa of ORDEN) {
        if (activasRef.current.has(capa)) void agregar(mapa, capa, idiomaRef.current, () => activasRef.current.has(capa) && mapaRef.current === mapa).catch(() => undefined)
        else quitar(mapa, capa)
      }
      const mundo = activasRef.current.has('destinos')
      try {
        if (mundo) {
          mapa.setTerrain(null)
          mapa.setProjection({ type: 'globe' })
        } else if (enMundoRef.current) {
          mapa.setProjection({ type: 'mercator' })
          if (mapa.getSource('rz-dem')) mapa.setTerrain({ source: 'rz-dem', exaggeration: 1.45 })
        }
      } catch {
        // Si el navegador no soporta el globo, la capa se ve igual en el mapa plano.
      }
      if (mundo && !enMundoRef.current) {
        mapa.flyTo({ center: [-40, 18], zoom: 1.5, pitch: 0, bearing: 0, duration: 2600, essential: true })
      } else if (!mundo && enMundoRef.current) {
        onSalirMundoRef.current()
      }
      enMundoRef.current = mundo
    }
    sincronizar()
    const alCargarEstilo = () => {
      enMundoRef.current = false
      // El estilo nuevo no trae las capas propias: se vuelven a agregar, y el globo se reaplica sin volar.
      for (const capa of ORDEN) if (activasRef.current.has(capa)) void agregar(mapa, capa, idiomaRef.current, () => activasRef.current.has(capa) && mapaRef.current === mapa).catch(() => undefined)
      if (activasRef.current.has('destinos')) {
        mapa.setTerrain(null)
        mapa.setProjection({ type: 'globe' })
        enMundoRef.current = true
      }
    }
    mapa.on('style.load', alCargarEstilo)
    return () => {
      mapa.off('style.load', alCargarEstilo)
    }
  }, [mapaRef, mapaListo, activas])

  // El idioma cambia etiquetas: se rehacen las capas que tienen texto traducido.
  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa || !mapaListo) return
    for (const capa of ['pcc', 'rios', 'puertos', 'destinos'] as CapaId[]) {
      if (!activasRef.current.has(capa)) continue
      quitar(mapa, capa)
      void agregar(mapa, capa, idioma, () => activasRef.current.has(capa) && mapaRef.current === mapa).catch(() => undefined)
    }
  }, [idioma, mapaRef, mapaListo])

  // Contorno del municipio elegido.
  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa || !mapaListo || !mapa.getLayer('rz-produccion-sel')) return
    mapa.setFilter('rz-produccion-sel', ['==', ['get', 'c'], municipioSeleccionado ?? ''])
  }, [mapaRef, mapaListo, municipioSeleccionado, activas])

  // Clics y cursor sobre las capas.
  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa || !mapaListo) return
    const presentes = () => (mapaRef.current === mapa ? CLIC.filter((id) => mapa.getLayer(id)) : [])
    const alClic = (e: { point: { x: number; y: number } }) => {
      const capas = presentes()
      if (!capas.length) return
      const tocadas = mapa.queryRenderedFeatures([e.point.x, e.point.y], { layers: capas })
      const primera = CLIC.map((id) => tocadas.find((f) => f.layer.id === id)).find(Boolean)
      if (primera) onContextoRef.current(contextoDe(primera))
    }
    const alMover = (e: { point: { x: number; y: number } }) => {
      const capas = presentes()
      const encima = capas.length > 0 && mapa.queryRenderedFeatures([e.point.x, e.point.y], { layers: capas }).length > 0
      mapa.getCanvas().style.cursor = encima ? 'pointer' : ''
    }
    mapa.on('click', alClic)
    mapa.on('mousemove', alMover)
    return () => {
      mapa.off('click', alClic)
      mapa.off('mousemove', alMover)
    }
  }, [mapaRef, mapaListo])

  // Animación del flujo de café en los arcos.
  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa || !mapaListo || !activas.has('destinos') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let paso = 0
    const temporizador = window.setInterval(() => {
      try {
        if (mapaRef.current !== mapa || !mapa.getLayer('rz-destinos-arcos')) return
        paso = (paso + 1) % DASH.length
        mapa.setPaintProperty('rz-destinos-arcos', 'line-dasharray', DASH[paso])
      } catch {
        window.clearInterval(temporizador)
      }
    }, 70)
    return () => window.clearInterval(temporizador)
  }, [mapaRef, mapaListo, activas])
}
