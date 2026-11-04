import type { ExpressionSpecification, GeoJSONSourceSpecification, Map as MapaGL, Marker, Popup, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { api } from '../../shared/api/client'
import type { Publication } from '../../shared/api/types'
import { env } from '../../shared/config/env'
import { formatLongDate, formatNumber } from '../../shared/format'
import { Icon } from '../../shared/ui'
import { cargarDatos, useCapasMapa } from './useCapasMapa'
import { DatosCuriosos, LeyendaProduccion, MunicipioDeFinca, PanelCapas, TarjetaContexto } from './CapasUI'
import { TEXTOS_CAPAS, centroPoligono, datosCuriosos, type CafeDatos, type CapaId, type Contexto, type Dato, type MunicipioCafe, type TextosCapas } from './capasMapa'
import './originExplorer.css'
import {
  TEXTOS,
  agruparPorMunicipio,
  etapaVisible,
  hash,
  nombreVisible,
  normalizar,
  pasosDocumentados,
  posicionarOrigenes,
  type GrupoMunicipio,
  type Idioma,
  type PuntoOrigen,
  type Textos,
  type TrazaOrigen,
} from './origenesMapa'

type MapLibre = typeof import('maplibre-gl')
type EstadoTraza = { estado: 'cargando' } | { estado: 'lista'; datos: TrazaOrigen } | { estado: 'error' }
type Modo = 'relieve' | 'satelite'
type ColeccionDptos = { type: 'FeatureCollection'; features: { type: 'Feature'; properties: Record<string, unknown> | null; geometry: unknown }[] }

// Colombia continental (sin San Andrés, para que el país llene la vista).
const BOUNDS_COLOMBIA: [[number, number], [number, number]] = [[-79.2, -4.3], [-66.8, 12.6]]
const ESTILO_RELIEVE = 'https://tiles.openfreemap.org/styles/liberty'
const ESTILO_SATELITE: StyleSpecification = {
  version: 8,
  sources: {
    satelite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 18,
      attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics',
    },
  },
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  layers: [{ id: 'satelite', type: 'raster', source: 'satelite' }],
}
const DEM_TILES = ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png']
const DEPARTAMENTOS_URL = 'https://raw.githubusercontent.com/ytolosa/mapas-colombia/main/output/geojson/col_departamentos_real_nacional.geojson'
// Por debajo de este zoom se ven burbujas por municipio; por encima, cada finca.
const ZOOM_FINCAS = 10
const ZOOM_DETALLE = 13.6
const VUELO_MS = 3200
const PAUSA_TOUR_MS = 4600

const CAPAS_INICIALES: CapaId[] = ['denominaciones', 'rios']
type ColeccionMunicipios = { features: { properties: MunicipioCafe; geometry: Parameters<typeof centroPoligono>[0] }[] }

const reducirMovimiento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function rutaTraza(origen: Publication) {
  return origen.isPublished === false ? `/publications/farms/${origen.id.replace(/^farm:/, '')}/traceability` : `/publications/${origen.id}/traceability`
}

function fotoDe(origen: Publication) {
  const evidencia = origen.evidences[0]?.evidence
  return evidencia ? `${env.apiUrl}/api/v1/publications/${origen.id}/photos/${evidencia.id}` : null
}

function nodo<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, texto?: string) {
  const el = document.createElement(tag)
  el.className = className
  if (texto !== undefined) el.textContent = texto
  return el
}

/**
 * Explorador inmersivo de orígenes para el portal público: mapa 3D con relieve
 * o satélite, vuelos entre fincas, recorrido guiado y fichas rápidas. Solo usa
 * datos públicos; las fincas sin ubicación pública se muestran en una zona
 * aproximada de su municipio.
 */
export function OriginExplorer({ origenes, fallo, onAbrir }: { origenes: Publication[] | undefined; fallo: boolean; onAbrir: (origen: Publication) => void }) {
  const [idioma, setIdioma] = useState<Idioma>(() => (typeof navigator !== 'undefined' && !navigator.language?.toLowerCase().startsWith('es') ? 'en' : 'es'))
  const t = TEXTOS[idioma]
  const [busqueda, setBusqueda] = useState('')
  const [region, setRegion] = useState('')
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [modo, setModo] = useState<Modo>('relieve')
  const [recorriendo, setRecorriendo] = useState(false)
  const [mapaListo, setMapaListo] = useState(false)
  const [sinMapa, setSinMapa] = useState(false)
  const [zoom, setZoom] = useState(5)
  const [trazas, setTrazas] = useState<Record<string, EstadoTraza>>({})
  const [activas, setActivas] = useState<Set<CapaId>>(() => new Set(CAPAS_INICIALES))
  const [contexto, setContexto] = useState<Contexto | null>(null)
  const [panelCapas, setPanelCapas] = useState(false)
  const [datosCafe, setDatosCafe] = useState<CafeDatos | null>(null)
  const [municipiosCafe, setMunicipiosCafe] = useState<ColeccionMunicipios | null>(null)
  const tc = TEXTOS_CAPAS[idioma]

  const contenedorRef = useRef<HTMLDivElement>(null)
  const raizRef = useRef<HTMLElement>(null)
  const mapaRef = useRef<MapaGL | null>(null)
  const libRef = useRef<MapLibre | null>(null)
  const marcadoresRef = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>())
  const burbujasRef = useRef<Marker[]>([])
  const popupRef = useRef<Popup | null>(null)
  const departamentosRef = useRef<ColeccionDptos | null>(null)
  const modoRef = useRef<Modo>('relieve')
  const regionesConFincasRef = useRef<string[]>([])
  const tiraRef = useRef<HTMLDivElement>(null)
  const vueloRef = useRef(0)

  const puntos = useMemo(() => posicionarOrigenes(origenes ?? []), [origenes])
  const regiones = useMemo(() => {
    const conteo = new Map<string, { nombre: string; n: number }>()
    for (const p of puntos) {
      const clave = normalizar(p.departamento)
      conteo.set(clave, { nombre: p.departamento, n: (conteo.get(clave)?.n ?? 0) + 1 })
    }
    return [...conteo.entries()].map(([clave, v]) => ({ clave, ...v })).sort((a, b) => b.n - a.n)
  }, [puntos])
  const filtrados = useMemo(() => {
    const q = normalizar(busqueda)
    return puntos
      .filter((p) => !region || normalizar(p.departamento) === region)
      .filter((p) => !q || normalizar(`${p.nombre} ${p.municipio} ${p.departamento}`).includes(q))
      .sort((a, b) => Number(b.origen.isPublished !== false) - Number(a.origen.isPublished !== false) || a.nombre.localeCompare(b.nombre, 'es'))
  }, [puntos, region, busqueda])
  const grupos = useMemo(() => agruparPorMunicipio(filtrados), [filtrados])
  const activo = filtrados.find((p) => p.origen.id === seleccion) ?? null
  const indiceActivo = activo ? filtrados.indexOf(activo) : -1
  const enMundo = activas.has('destinos')

  // Datos de contexto del café (fuentes abiertas, ver scripts/datos-mapa).
  useEffect(() => {
    let vigente = true
    cargarDatos<CafeDatos>('cafe-datos.json').then((d) => vigente && setDatosCafe(d)).catch(() => undefined)
    cargarDatos<ColeccionMunicipios>('cafe-municipios.geojson').then((d) => vigente && setMunicipiosCafe(d)).catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [])
  const municipioPorNombre = useMemo(() => {
    const mapa = new Map<string, MunicipioCafe>()
    for (const f of municipiosCafe?.features ?? []) mapa.set(`${normalizar(f.properties.d)}|${normalizar(f.properties.m)}`, f.properties)
    return mapa
  }, [municipiosCafe])
  const curiosidades = useMemo<Dato[]>(() => {
    if (!datosCafe) return []
    const top = municipiosCafe?.features.find((f) => f.properties.r === 1)
    const municipioTop = top ? { nombre: nombreVisible(top.properties.m), centro: centroPoligono(top.geometry) } : null
    const fincasEnTop = top ? puntos.filter((p) => normalizar(p.municipio) === normalizar(top.properties.m) && normalizar(p.departamento) === normalizar(top.properties.d)).length : 0
    return datosCuriosos(datosCafe, idioma, { municipioTop, fincasEnTop })
  }, [datosCafe, municipiosCafe, idioma, puntos])
  const municipioActivo = activo ? municipioPorNombre.get(`${normalizar(activo.departamento)}|${normalizar(activo.municipio)}`) : undefined

  useEffect(() => {
    regionesConFincasRef.current = regiones.map((r) => r.clave)
  }, [regiones])

  // ---------------------------------------------------------------- datos ----
  const pedidasRef = useRef(new Set<string>())
  const cargarTraza = useCallback((origen: Publication) => {
    if (pedidasRef.current.has(origen.id)) return
    pedidasRef.current.add(origen.id)
    setTrazas((s) => ({ ...s, [origen.id]: { estado: 'cargando' } }))
    api<TrazaOrigen>(rutaTraza(origen))
      .then((datos) => setTrazas((s) => ({ ...s, [origen.id]: { estado: 'lista', datos } })))
      .catch(() => {
        pedidasRef.current.delete(origen.id)
        setTrazas((s) => ({ ...s, [origen.id]: { estado: 'error' } }))
      })
  }, [])

  // ---------------------------------------------------------------- mapa -----
  const decorarEstilo = useCallback((mapa: MapaGL) => {
    try {
      if (!mapa.getSource('rz-dem')) mapa.addSource('rz-dem', { type: 'raster-dem', tiles: DEM_TILES, encoding: 'terrarium', tileSize: 256, maxzoom: 14 })
      if (!mapa.getSource('rz-sombras')) mapa.addSource('rz-sombras', { type: 'raster-dem', tiles: DEM_TILES, encoding: 'terrarium', tileSize: 256, maxzoom: 14 })
      if (modoRef.current === 'relieve' && !mapa.getLayer('rz-sombras')) {
        const primeraEtiqueta = mapa.getStyle().layers?.find((l) => l.type === 'symbol')?.id
        mapa.addLayer({ id: 'rz-sombras', type: 'hillshade', source: 'rz-sombras', paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': '#2d3b29' } }, primeraEtiqueta)
      }
      mapa.setTerrain({ source: 'rz-dem', exaggeration: 1.45 })
      mapa.setSky?.({ 'sky-color': '#9fc5dd', 'horizon-color': '#f4efe2', 'fog-color': '#f4efe2', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.25 })
    } catch {
      // Sin relieve el mapa sigue funcionando en 2D.
    }
    const pintarDepartamentos = (datos: ColeccionDptos) => {
      if (mapa.getSource('rz-dptos')) return
      mapa.addSource('rz-dptos', { type: 'geojson', data: datos as GeoJSONSourceSpecification['data'] })
      const conFincas = ['in', ['get', 'rz_norm'], ['literal', regionesConFincasRef.current]] as ExpressionSpecification
      const etiquetas = mapa.getStyle().layers?.find((l) => l.type === 'symbol' && !l.id.startsWith('rz-'))?.id
      mapa.addLayer({ id: 'rz-dptos-relleno', type: 'fill', source: 'rz-dptos', paint: { 'fill-color': '#d6a84b', 'fill-opacity': ['case', conFincas, 0.16, 0] } }, etiquetas)
      mapa.addLayer({ id: 'rz-dptos-borde', type: 'line', source: 'rz-dptos', paint: { 'line-color': modoRef.current === 'satelite' ? '#ffffff' : '#56704a', 'line-opacity': 0.55, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 9, 1.4] } }, etiquetas)
    }
    if (departamentosRef.current) pintarDepartamentos(departamentosRef.current)
    else
      fetch(DEPARTAMENTOS_URL)
        .then((r) => (r.ok ? (r.json() as Promise<ColeccionDptos>) : Promise.reject()))
        .then((datos) => {
          datos.features.forEach((f) => {
            f.properties = { ...f.properties, rz_norm: normalizar(String(f.properties?.dpto_nombre ?? '')) }
          })
          departamentosRef.current = datos
          if (mapaRef.current === mapa && mapa.isStyleLoaded()) pintarDepartamentos(datos)
        })
        .catch(() => undefined)
  }, [])

  useEffect(() => {
    let cancelado = false
    let mapa: MapaGL | null = null
    import('maplibre-gl')
      .then((lib) => {
        const maplibre = (lib as unknown as { default?: MapLibre }).default ?? lib
        if (cancelado || !contenedorRef.current) return
        try {
          mapa = new maplibre.Map({
            container: contenedorRef.current,
            style: ESTILO_RELIEVE,
            bounds: BOUNDS_COLOMBIA,
            fitBoundsOptions: { padding: 30 },
            maxPitch: 78,
            attributionControl: { compact: true },
          })
        } catch {
          setSinMapa(true)
          return
        }
        libRef.current = maplibre
        mapaRef.current = mapa
        mapa.addControl(new maplibre.NavigationControl({ visualizePitch: true }), 'bottom-right')
        mapa.on('style.load', () => mapa && decorarEstilo(mapa))
        mapa.once('style.load', () => setMapaListo(true))
        mapa.on('zoom', () => mapa && setZoom(Math.round(mapa.getZoom() * 2) / 2))
        const detenerTour = () => setRecorriendo(false)
        mapa.on('dragstart', detenerTour)
        mapa.on('wheel', detenerTour)
        mapa.on('touchstart', detenerTour)
        mapa.on('error', () => undefined)
      })
      .catch(() => setSinMapa(true))
    const marcadores = marcadoresRef.current
    return () => {
      cancelado = true
      mapa?.remove()
      mapaRef.current = null
      marcadores.clear()
    }
  }, [decorarEstilo])

  // Cambio relieve / satélite.
  useEffect(() => {
    modoRef.current = modo
    const mapa = mapaRef.current
    if (!mapa || !mapaListo) return
    mapa.setStyle(modo === 'satelite' ? ESTILO_SATELITE : ESTILO_RELIEVE, { diff: false })
  }, [modo, mapaListo])

  // Resalta los departamentos que tienen fincas cuando cambian los datos.
  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa || !mapaListo || !mapa.getLayer('rz-dptos-relleno')) return
    mapa.setPaintProperty('rz-dptos-relleno', 'fill-opacity', ['case', ['in', ['get', 'rz_norm'], ['literal', regiones.map((r) => r.clave)]], 0.16, 0])
  }, [regiones, mapaListo])

  const volarA = useCallback((punto: PuntoOrigen, duracion = VUELO_MS) => {
    const mapa = mapaRef.current
    if (!mapa) return
    const ancho = contenedorRef.current?.clientWidth ?? 1000
    const padding = ancho < 760 ? { top: 20, bottom: Math.round((contenedorRef.current?.clientHeight ?? 640) * 0.56), left: 0, right: 0 } : { top: 40, bottom: 150, left: 0, right: 380 }
    const centro: [number, number] = [punto.lng, punto.lat]
    const vuelo = ++vueloRef.current
    mapa.flyTo({
      center: centro,
      zoom: 13.2,
      pitch: 60,
      bearing: (hash(punto.origen.id) % 70) - 35,
      duration: reducirMovimiento() ? 0 : duracion,
      curve: 1.6,
      essential: true,
      padding,
    })
    // Con relieve, el terreno del destino carga durante el vuelo y la finca
    // queda corrida en pantalla. Se mide dónde quedó y se corrige en píxeles.
    const corregir = () => {
      if (mapaRef.current !== mapa || vueloRef.current !== vuelo) return
      const el = marcadoresRef.current.get(punto.origen.id)?.el
      const caja = contenedorRef.current?.getBoundingClientRect()
      if (!el || !caja) return
      const r = el.getBoundingClientRect()
      const dx = r.left + r.width / 2 - (caja.left + padding.left + (caja.width - padding.left - padding.right) / 2)
      const dy = r.top + r.height / 2 - (caja.top + padding.top + (caja.height - padding.top - padding.bottom) / 2)
      if (Math.hypot(dx, dy) > 24) mapa.panBy([dx, dy], { duration: reducirMovimiento() ? 0 : 650 })
    }
    mapa.once('moveend', () => {
      corregir()
      mapa.once('idle', corregir)
    })
  }, [])

  const seleccionar = useCallback(
    (punto: PuntoOrigen | null, volar = true) => {
      setSeleccion(punto?.origen.id ?? null)
      if (!punto) return
      setContexto(null)
      cargarTraza(punto.origen)
      if (volar) volarA(punto)
    },
    [cargarTraza, volarA],
  )

  const vistaColombia = useCallback(() => {
    setRecorriendo(false)
    setSeleccion(null)
    mapaRef.current?.fitBounds(BOUNDS_COLOMBIA, { padding: 30, pitch: 0, bearing: 0, duration: reducirMovimiento() ? 0 : 2200 })
  }, [])

  // ------------------------------------------------------- capas de contexto -
  const elegirContexto = useCallback((c: Contexto | null) => {
    setContexto(c)
    if (c) {
      setRecorriendo(false)
      setSeleccion(null)
    }
  }, [])

  useCapasMapa({
    mapaRef,
    mapaListo,
    activas,
    idioma,
    municipioSeleccionado: contexto?.tipo === 'municipio' ? contexto.datos.c : null,
    onContexto: elegirContexto,
    onSalirMundo: vistaColombia,
  })

  const alternarCapa = (capa: CapaId) => {
    setActivas((actual) => {
      const nuevas = new Set(actual)
      if (nuevas.has(capa)) nuevas.delete(capa)
      else nuevas.add(capa)
      return nuevas
    })
    if (capa === 'destinos') {
      setRecorriendo(false)
      setSeleccion(null)
      setContexto(activas.has('destinos') ? null : { tipo: 'exportaciones' })
    }
  }

  const verDato = (dato: Dato) => {
    setContexto(null)
    setRecorriendo(false)
    setSeleccion(null)
    setActivas((actual) => {
      const nuevas = new Set(actual)
      dato.accion.capas.forEach((c) => nuevas.add(c))
      if (dato.accion.vista !== 'mundo') nuevas.delete('destinos')
      return nuevas
    })
    const mapa = mapaRef.current
    if (dato.accion.vista === 'mundo') setContexto({ tipo: 'exportaciones' })
    if (!mapa || dato.accion.vista === 'mundo') return
    const enGlobo = activas.has('destinos')
    // Si se sale del globo, el propio cambio de capa devuelve la vista a Colombia.
    if (dato.accion.vista === 'colombia') {
      if (!enGlobo) mapa.fitBounds(BOUNDS_COLOMBIA, { padding: 30, pitch: 0, bearing: 0, duration: reducirMovimiento() ? 0 : 2200 })
    } else {
      const { centro, zoom: z } = dato.accion.vista
      window.setTimeout(() => mapa.flyTo({ center: centro, zoom: z, pitch: 45, bearing: 0, duration: reducirMovimiento() ? 0 : 2600, essential: true }), enGlobo ? 2400 : 0)
    }
  }

  const acercarGrupo = useCallback((grupo: GrupoMunicipio) => {
    const mapa = mapaRef.current
    const lib = libRef.current
    if (!mapa || !lib) return
    setRecorriendo(false)
    const caja = new lib.LngLatBounds()
    grupo.puntos.forEach((p) => caja.extend([p.lng, p.lat]))
    mapa.fitBounds(caja, { padding: 90, maxZoom: 13.2, pitch: 52, bearing: -18, duration: reducirMovimiento() ? 0 : 2800 })
  }, [])

  // Marcadores de fincas (se recrean solo cuando cambia la lista filtrada).
  useEffect(() => {
    const mapa = mapaRef.current
    const lib = libRef.current
    if (!mapa || !lib || !mapaListo) return
    const actuales = marcadoresRef.current
    const ids = new Set(filtrados.map((p) => p.origen.id))
    for (const [id, { marker }] of actuales) {
      if (!ids.has(id)) {
        marker.remove()
        actuales.delete(id)
      }
    }
    for (const punto of filtrados) {
      if (actuales.has(punto.origen.id)) continue
      const el = nodo('button', `rz-pin${punto.origen.isPublished !== false ? ' publicado' : ''}`)
      el.type = 'button'
      el.setAttribute('aria-label', `${punto.nombre}, ${punto.municipio}`)
      el.append(nodo('span', 'rz-pin-punto'))
      const etiqueta = nodo('span', 'rz-pin-etiqueta')
      etiqueta.append(nodo('b', '', punto.nombre), nodo('small', '', [punto.municipio, punto.departamento].filter(Boolean).join(', ')))
      el.append(etiqueta)
      el.addEventListener('mouseenter', () => setHover(punto.origen.id))
      el.addEventListener('mouseleave', () => setHover((h) => (h === punto.origen.id ? null : h)))
      el.addEventListener('focus', () => setHover(punto.origen.id))
      el.addEventListener('blur', () => setHover((h) => (h === punto.origen.id ? null : h)))
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        setRecorriendo(false)
        seleccionar(punto)
      })
      const marker = new lib.Marker({ element: el, anchor: 'center' }).setLngLat([punto.lng, punto.lat]).addTo(mapa)
      actuales.set(punto.origen.id, { marker, el })
    }
  }, [filtrados, mapaListo, seleccionar])

  // Burbujas por municipio para la vista lejana.
  useEffect(() => {
    const mapa = mapaRef.current
    const lib = libRef.current
    if (!mapa || !lib || !mapaListo) return
    burbujasRef.current.forEach((m) => m.remove())
    burbujasRef.current = grupos.map((grupo) => {
      const el = nodo('button', 'rz-burbuja')
      el.type = 'button'
      el.setAttribute('aria-label', `${grupo.municipio}, ${grupo.departamento}: ${t.fincas(grupo.puntos.length)}`)
      el.append(nodo('strong', '', String(grupo.puntos.length)))
      const texto = nodo('span', '')
      texto.append(nodo('b', '', grupo.municipio || grupo.departamento), nodo('small', '', grupo.departamento))
      el.append(texto)
      el.addEventListener('click', () => acercarGrupo(grupo))
      return new lib.Marker({ element: el, anchor: 'center' }).setLngLat([grupo.lng, grupo.lat]).addTo(mapa)
    })
  }, [grupos, mapaListo, acercarGrupo, t])

  // Estados visuales de los marcadores.
  useEffect(() => {
    for (const [id, { el, marker }] of marcadoresRef.current) {
      const esActivo = id === activo?.origen.id
      marker.setOpacity('1', esActivo ? '1' : '0.35')
      el.classList.toggle('activo', esActivo)
      el.classList.toggle('hover', id === hover)
      el.setAttribute('aria-pressed', String(id === activo?.origen.id))
    }
  }, [activo, hover, filtrados])

  // Ficha rápida al pasar el cursor.
  useEffect(() => {
    const mapa = mapaRef.current
    const lib = libRef.current
    popupRef.current?.remove()
    popupRef.current = null
    const punto = filtrados.find((p) => p.origen.id === hover)
    if (!mapa || !lib || !punto || punto.origen.id === seleccion) return
    const traza = trazas[punto.origen.id]
    const cont = nodo('div', 'rz-popup-cuerpo')
    cont.append(nodo('span', 'rz-popup-estado', punto.origen.isPublished !== false ? t.publicado : t.registrada))
    cont.append(nodo('strong', '', punto.nombre))
    cont.append(nodo('small', '', [punto.municipio, punto.departamento].filter(Boolean).join(', ')))
    if (traza?.estado === 'lista') {
      const d = traza.datos
      const datos = [d.origin.farmType && t.tipos[d.origin.farmType], d.crop && [d.crop.species, d.crop.variety].filter(Boolean).join(' · ')].filter(Boolean)
      if (datos.length) cont.append(nodo('em', '', datos.join(' — ')))
    }
    cont.append(nodo('i', '', t.clicMas))
    popupRef.current = new lib.Popup({ closeButton: false, closeOnClick: false, offset: 16, className: 'rz-popup', maxWidth: '260px' })
      .setLngLat([punto.lng, punto.lat])
      .setDOMContent(cont)
      .addTo(mapa)
    const temporizador = window.setTimeout(() => cargarTraza(punto.origen), 300)
    return () => window.clearTimeout(temporizador)
  }, [hover, seleccion, filtrados, trazas, t, cargarTraza])

  // Recorrido guiado: vuela de finca en finca y gira despacio sobre cada una.
  useEffect(() => {
    if (!recorriendo || filtrados.length === 0) return
    const actual = activo
    if (!actual) return
    const giro = window.setTimeout(() => {
      const mapa = mapaRef.current
      if (mapa && !reducirMovimiento()) mapa.easeTo({ bearing: mapa.getBearing() + 28, duration: PAUSA_TOUR_MS - 1200, easing: (x) => x })
    }, VUELO_MS + 900)
    const siguiente = window.setTimeout(() => {
      const i = filtrados.indexOf(actual)
      seleccionar(filtrados[(i + 1) % filtrados.length])
    }, VUELO_MS + PAUSA_TOUR_MS)
    return () => {
      window.clearTimeout(giro)
      window.clearTimeout(siguiente)
    }
  }, [recorriendo, activo, filtrados, seleccionar])

  // Mantiene visible en la tira la tarjeta de la finca activa.
  useEffect(() => {
    if (!seleccion) return
    const tarjeta = tiraRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(seleccion)}"]`)
    tarjeta?.scrollIntoView?.({ behavior: reducirMovimiento() ? 'auto' : 'smooth', inline: 'center', block: 'nearest' })
  }, [seleccion])

  const mover = (paso: number) => {
    if (!filtrados.length) return
    setRecorriendo(false)
    const i = indiceActivo < 0 ? (paso > 0 ? -1 : 0) : indiceActivo
    seleccionar(filtrados[(i + paso + filtrados.length) % filtrados.length])
  }

  const elegirRegion = (clave: string) => {
    setRecorriendo(false)
    setRegion(clave)
    const mapa = mapaRef.current
    const lib = libRef.current
    if (!mapa || !lib) return
    const dePuntos = puntos.filter((p) => !clave || normalizar(p.departamento) === clave)
    if (!clave || !dePuntos.length) return vistaColombia()
    const caja = new lib.LngLatBounds()
    dePuntos.forEach((p) => caja.extend([p.lng, p.lat]))
    mapa.fitBounds(caja, { padding: 120, maxZoom: 11, pitch: 40, bearing: 0, duration: reducirMovimiento() ? 0 : 2600 })
  }

  const onTecla = (e: ReactKeyboardEvent) => {
    const objetivo = e.target as HTMLElement
    if (objetivo.tagName === 'INPUT' || objetivo.tagName === 'SELECT') return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      mover(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      mover(-1)
    } else if (e.key === 'Escape' && (seleccion || contexto)) {
      setRecorriendo(false)
      setSeleccion(null)
      setContexto(null)
    }
  }

  const nivelZoom = zoom >= ZOOM_DETALLE ? 'cerca' : zoom >= ZOOM_FINCAS ? 'medio' : 'lejos'

  return (
    <section className={`rz-explorer zoom-${nivelZoom}${activo || contexto ? ' con-ficha' : ''}${enMundo ? ' modo-mundo' : ''}`} id="explorar" ref={raizRef} onKeyDown={onTecla} aria-label={t.titulo}>
      <div className="rz-mapa-zona">
        <div className="rz-mapa" ref={contenedorRef} />
        {sinMapa && <div className="rz-sin-mapa">{t.sinMapa}</div>}
        {!mapaListo && !sinMapa && <div className="rz-cargando-mapa" aria-hidden="true"><span /></div>}

        <header className="rz-cabecera">
          <div className="rz-titulo">
            <span>{t.kicker}</span>
            <h2>{t.titulo}</h2>
            <p>{t.subtitulo}</p>
          </div>
          <div className="rz-buscador">
            <Icon name="search" size={16} />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder={t.buscar} aria-label={t.buscar} />
            <button type="button" className="rz-idioma" onClick={() => setIdioma(idioma === 'es' ? 'en' : 'es')} lang={idioma === 'es' ? 'en' : 'es'}>
              {t.idioma}
            </button>
          </div>
          <div className="rz-chips" role="group" aria-label={t.todas}>
            <button type="button" className={!region ? 'activo' : ''} aria-pressed={!region} onClick={() => elegirRegion('')}>
              {t.todas} <b>{puntos.length}</b>
            </button>
            {regiones.map((r) => (
              <button type="button" key={r.clave} className={region === r.clave ? 'activo' : ''} aria-pressed={region === r.clave} onClick={() => elegirRegion(region === r.clave ? '' : r.clave)}>
                {r.nombre} <b>{r.n}</b>
              </button>
            ))}
          </div>
        </header>

        <div className="rz-controles" role="group" aria-label="Vista del mapa">
          <div className="rz-segmento">
            <button type="button" className={modo === 'relieve' ? 'activo' : ''} aria-pressed={modo === 'relieve'} onClick={() => setModo('relieve')}>
              {t.relieve}
            </button>
            <button type="button" className={modo === 'satelite' ? 'activo' : ''} aria-pressed={modo === 'satelite'} onClick={() => setModo('satelite')}>
              {t.satelite}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              const mapa = mapaRef.current
              if (mapa) mapa.easeTo({ pitch: mapa.getPitch() > 20 ? 0 : 60, duration: 900 })
            }}
          >
            {t.vista3d}
          </button>
          <button type="button" onClick={() => (enMundo ? alternarCapa('destinos') : vistaColombia())}>
            <Icon name="location" size={14} /> {t.colombia}
          </button>
          <button type="button" className={`rz-boton-capas${panelCapas ? ' activo' : ''}`} aria-expanded={panelCapas} onClick={() => setPanelCapas(!panelCapas)}>
            <Icon name="menu" size={14} /> {tc.capas} <b>{activas.size}</b>
          </button>
        </div>
        {panelCapas && <PanelCapas activas={activas} onCambiar={alternarCapa} t={tc} onCerrar={() => setPanelCapas(false)} />}

        <div className="rz-tour">
          <button type="button" aria-label={t.anterior} title={t.anterior} onClick={() => mover(-1)} disabled={!filtrados.length}>
            ‹
          </button>
          <button type="button" className="rz-tour-play" onClick={() => {
              if (!recorriendo && !activo && filtrados[0]) seleccionar(filtrados[0])
              setRecorriendo(!recorriendo)
            }} disabled={!filtrados.length || sinMapa || enMundo}>
            <span aria-hidden="true">{recorriendo ? '❚❚' : '▶'}</span> {recorriendo ? t.pausar : t.recorrer}
          </button>
          <button type="button" aria-label={t.siguiente} title={t.siguiente} onClick={() => mover(1)} disabled={!filtrados.length}>
            ›
          </button>
          {activo && (
            <span className="rz-tour-cuenta">
              {indiceActivo + 1} / {filtrados.length}
            </span>
          )}
        </div>

        {!activo && !contexto && curiosidades.length > 0 && (
          <DatosCuriosos
            datos={curiosidades}
            t={tc}
            onVer={verDato}
            pie={
              <>
                {activas.has('produccion') && <LeyendaProduccion t={tc} idioma={idioma} />}
                <small className="rz-region-privacidad">{zoom >= ZOOM_FINCAS ? t.pistaCerca : t.pistaInicio} {t.leyenda}</small>
              </>
            }
          />
        )}

        {contexto && !activo && (
          <TarjetaContexto contexto={contexto} datosCafe={datosCafe} t={tc} idioma={idioma} cerrar={t.cerrar} onCerrar={() => setContexto(null)} onContexto={elegirContexto} onVolar={(lng, lat) => mapaRef.current?.flyTo({ center: [lng, lat], zoom: 2.6, duration: reducirMovimiento() ? 0 : 1800, essential: true })} />
        )}

        {activo && (
          <FichaFinca
            punto={activo}
            traza={trazas[activo.origen.id]}
            t={t}
            idioma={idioma}
            onCerrar={() => {
              setRecorriendo(false)
              setSeleccion(null)
            }}
            onAbrir={() => {
              setRecorriendo(false)
              onAbrir(activo.origen)
            }}
            onReintentar={() => cargarTraza(activo.origen)}
            municipio={municipioActivo}
            datosCafe={datosCafe}
            tc={tc}
            onContexto={elegirContexto}
          />
        )}
      </div>

      <div className="rz-tira" ref={tiraRef} role="list" aria-label={t.titulo}>
        {!origenes && !fallo && <p className="rz-tira-nota">{t.cargandoFincas}</p>}
        {fallo && <p className="rz-tira-nota">{t.errorFincas}</p>}
        {origenes && filtrados.length === 0 && <p className="rz-tira-nota">{t.vacio}</p>}
        {filtrados.map((p) => (
          <button
            type="button"
            role="listitem"
            key={p.origen.id}
            data-id={p.origen.id}
            className={`rz-tarjeta${p.origen.id === seleccion ? ' activa' : ''}`}
            onMouseEnter={() => setHover(p.origen.id)}
            onMouseLeave={() => setHover((h) => (h === p.origen.id ? null : h))}
            onClick={() => {
              setRecorriendo(false)
              seleccionar(p)
            }}
          >
            <span className={`rz-tarjeta-foto${p.origen.isPublished !== false ? ' publicado' : ''}`} style={fotoDe(p.origen) ? { backgroundImage: `url("${fotoDe(p.origen)}")` } : undefined}>
              {!fotoDe(p.origen) && <Icon name="leaf" size={18} />}
            </span>
            <span className="rz-tarjeta-texto">
              <small>{p.origen.isPublished !== false ? t.publicado : t.registrada}</small>
              <strong>{p.nombre}</strong>
              <em>{[p.municipio, p.departamento].filter(Boolean).join(', ')}</em>
            </span>
          </button>
        ))}
      </div>
      <p className="rz-anuncio" aria-live="polite">
        {activo ? `${activo.nombre}, ${activo.municipio}` : ''}
      </p>
    </section>
  )
}

function FichaFinca({
  punto,
  traza,
  t,
  idioma,
  onCerrar,
  onAbrir,
  onReintentar,
  municipio,
  datosCafe,
  tc,
  onContexto,
}: {
  punto: PuntoOrigen
  traza: EstadoTraza | undefined
  t: Textos
  idioma: Idioma
  onCerrar: () => void
  onAbrir: () => void
  onReintentar: () => void
  municipio: MunicipioCafe | undefined
  datosCafe: CafeDatos | null
  tc: TextosCapas
  onContexto: (c: Contexto) => void
}) {
  const foto = fotoDe(punto.origen)
  const datos = traza?.estado === 'lista' ? traza.datos : null
  const pasos = datos ? pasosDocumentados(datos) : []
  const hechos = pasos.filter((p) => p.hecho).length
  const procesos = datos?.processes ?? []
  const procesoActual = procesos.at(-1)
  const certificaciones = [...new Set(procesos.flatMap((p) => p.products.flatMap((x) => x.certifications.map((c) => c.certifier))))]
  const labores = datos ? Object.entries(datos.practices.laborsByType).reduce((s, [tipo, n]) => (tipo === 'COSECHA' ? s : s + (n ?? 0)), 0) : 0
  const practicas = datos
    ? [labores > 0 && t.labores(labores), datos.practices.soilAnalyses > 0 && t.suelos(datos.practices.soilAnalyses), datos.practices.bioinputApplications > 0 && t.bioinsumos(datos.practices.bioinputApplications)].filter(Boolean).join(' · ')
    : ''
  const fecha = (valor: string) => (idioma === 'en' ? new Date(valor).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : formatLongDate(valor))

  return (
    <aside className="rz-ficha" aria-label={punto.nombre}>
      <div className={`rz-ficha-foto${foto ? '' : ' sin-foto'}`} style={foto ? { backgroundImage: `url("${foto}")` } : undefined}>
        <button type="button" onClick={onCerrar} aria-label={t.cerrar}>
          <Icon name="close" size={16} />
        </button>
        <span className={`rz-estado${punto.origen.isPublished !== false ? ' publicado' : ''}`}>{punto.origen.isPublished !== false ? t.publicado : t.registrada}</span>
      </div>
      <div className="rz-ficha-cuerpo">
        <h3>{punto.nombre}</h3>
        <p className="rz-ficha-lugar">
          <Icon name="location" size={13} /> {[punto.municipio, punto.departamento].filter(Boolean).join(', ') || 'Colombia'}
        </p>
        <p className="rz-ficha-privacidad">{punto.aproximado ? t.zonaAproximada : t.ubicacionCompartida}</p>
        {municipio && datosCafe && <MunicipioDeFinca m={municipio} total={datosCafe.produccion.municipios} anio={datosCafe.produccion.anio} t={tc} onContexto={onContexto} />}

        {(!traza || traza.estado === 'cargando') && (
          <div className="rz-ficha-cargando" role="status">
            <span />
            <span />
            <span />
            <small>{t.cargando}</small>
          </div>
        )}
        {traza?.estado === 'error' && (
          <p className="rz-ficha-error">
            {t.sinTraza}{' '}
            <button type="button" onClick={onReintentar}>
              ↻
            </button>
          </p>
        )}
        {datos && (
          <>
            <div className="rz-progreso" aria-label={`${t.recorrido}: ${t.pasos(hechos, pasos.length)}`}>
              <div>
                <small>{t.recorrido}</small>
                <b>{t.pasos(hechos, pasos.length)}</b>
              </div>
              <ol>
                {pasos.map((p) => (
                  <li key={p.clave} className={p.hecho ? 'hecho' : ''} />
                ))}
              </ol>
            </div>
            <dl className="rz-datos">
              <div>
                <dt>{t.tipo}</dt>
                <dd>{datos.origin.farmType ? t.tipos[datos.origin.farmType] : t.sinDatos}</dd>
              </div>
              <div>
                <dt>{t.cultivo}</dt>
                <dd>{datos.crop ? [datos.crop.species, datos.crop.variety].filter(Boolean).join(' · ') : t.sinDatos}</dd>
              </div>
              {'lotsCount' in datos && (
                <div>
                  <dt>{t.lotes}</dt>
                  <dd>{datos.lotsCount}</dd>
                </div>
              )}
              {'harvestsCount' in datos && (
                <div>
                  <dt>{t.cosechas}</dt>
                  <dd>{datos.harvestsCount}</dd>
                </div>
              )}
              {datos.harvest && (
                <div className="ancho">
                  <dt>{t.ultimaCosecha}</dt>
                  <dd>
                    {formatNumber(datos.harvest.quantity)} {datos.harvest.unit} · {fecha(datos.harvest.date)}
                  </dd>
                </div>
              )}
              {procesoActual && (
                <div className="ancho destacado">
                  <dt>{t.proceso}</dt>
                  <dd>
                    {[...procesoActual.events.map((e) => e.stage), procesoActual.stage]
                      .filter((etapa, i, todas) => todas.indexOf(etapa) === i)
                      .map((etapa) => etapaVisible(etapa, idioma))
                      .join(' → ')}
                  </dd>
                </div>
              )}
              {practicas && (
                <div className="ancho">
                  <dt>{t.practicas}</dt>
                  <dd>{practicas}</dd>
                </div>
              )}
              {certificaciones.length > 0 && (
                <div className="ancho">
                  <dt>{t.certificaciones}</dt>
                  <dd>{certificaciones.join(', ')}</dd>
                </div>
              )}
            </dl>
          </>
        )}
        <button type="button" className="rz-ficha-cta" onClick={onAbrir}>
          {t.verHistoria} <Icon name="arrow" size={15} />
        </button>
      </div>
    </aside>
  )
}
