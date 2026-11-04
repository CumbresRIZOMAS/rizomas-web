import type { Publication, PublicFarmTraceability, PublicTraceability } from '../../shared/api/types'
import centroides from './municipiosCentroides.json'

// Lógica pura del explorador de orígenes: ubica cada finca en el mapa,
// arregla los nombres para mostrarlos y guarda los textos ES/EN.

export type Idioma = 'es' | 'en'
export type TrazaOrigen = PublicTraceability | PublicFarmTraceability

export type PuntoOrigen = {
  origen: Publication
  nombre: string
  municipio: string
  departamento: string
  /** Clave normalizada "DEPARTAMENTO|MUNICIPIO" para agrupar fincas. */
  grupo: string
  lng: number
  lat: number
  /** true si la posición es una zona aproximada calculada (no la ubicación pública de la finca). */
  aproximado: boolean
}

const CENTROIDES = centroides as unknown as Record<string, [number, number]>

export function normalizar(value: string | null | undefined) {
  return (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLocaleUpperCase('es')
}

const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en'])

/** "BRISAS DEL MAGDALENA" → "Brisas del Magdalena". Solo cambia textos escritos todo en mayúsculas. */
export function nombreVisible(value: string | null | undefined) {
  const texto = (value ?? '').trim().replace(/\s+/g, ' ')
  if (!texto || texto !== texto.toLocaleUpperCase('es') || !/\p{L}/u.test(texto)) return texto
  return texto
    .toLocaleLowerCase('es')
    .split(' ')
    .map((palabra, i) => (i > 0 && CONECTORES.has(palabra) ? palabra : palabra.charAt(0).toLocaleUpperCase('es') + palabra.slice(1)))
    .join(' ')
}

/** Hash estable (FNV-1a) para que cada finca quede siempre en el mismo sitio y ángulo. */
export function hash(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const centroDepartamento = new Map<string, [number, number] | null>()

function centroDe(departamento: string, municipio: string): [number, number] | null {
  const exacto = CENTROIDES[`${departamento}|${municipio}`]
  if (exacto) return exacto
  if (!departamento) return null
  if (!centroDepartamento.has(departamento)) {
    // Acepta variantes como "BOGOTA" frente a "BOGOTA, D.C.".
    const claves = Object.keys(CENTROIDES).filter((k) => {
      const dpto = k.split('|')[0]
      return dpto === departamento || dpto.startsWith(`${departamento},`) || dpto.startsWith(`${departamento} `)
    })
    const enMunicipio = municipio ? claves.find((k) => k.endsWith(`|${municipio}`)) : undefined
    if (enMunicipio) return CENTROIDES[enMunicipio]
    const puntos = claves.map((k) => CENTROIDES[k])
    centroDepartamento.set(
      departamento,
      puntos.length ? [puntos.reduce((s, p) => s + p[0], 0) / puntos.length, puntos.reduce((s, p) => s + p[1], 0) / puntos.length] : null,
    )
  }
  return centroDepartamento.get(departamento) ?? null
}

function ubicacionPublica(origen: Publication): [number, number] | null {
  const lat = Number(origen.publicLocation?.latitude)
  const lng = Number(origen.publicLocation?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  if (origen.publicLocation?.latitude == null || origen.publicLocation?.longitude == null) return null
  return [lat, lng]
}

/**
 * Ubica las fincas en el mapa. El portal nunca recibe coordenadas exactas:
 * si la finca autorizó una ubicación pública se usa esa; si no, se reparte
 * alrededor del centro de su municipio (patrón girasol, ~1–9 km) para que
 * se vean separadas sin revelar dónde está cada una.
 */
export function posicionarOrigenes(origenes: Publication[]): PuntoOrigen[] {
  const grupos = new Map<string, Publication[]>()
  for (const origen of origenes) {
    const grupo = `${normalizar(origen.region)}|${normalizar(origen.municipality)}`
    grupos.set(grupo, [...(grupos.get(grupo) ?? []), origen])
  }
  const puntos: PuntoOrigen[] = []
  for (const [grupo, lista] of grupos) {
    const [departamento, municipio] = grupo.split('|')
    const centro = centroDe(departamento, municipio)
    const ordenadas = [...lista].sort((a, b) => hash(a.id) - hash(b.id) || a.id.localeCompare(b.id))
    let indice = 0
    for (const origen of ordenadas) {
      const base = {
        origen,
        nombre: nombreVisible(origen.farmName ?? origen.title),
        municipio: nombreVisible(origen.municipality),
        departamento: nombreVisible(origen.region),
        grupo,
      }
      const publica = ubicacionPublica(origen)
      if (publica) {
        puntos.push({ ...base, lat: publica[0], lng: publica[1], aproximado: false })
        continue
      }
      if (!centro) continue
      const angulo = indice * 2.399963 + (hash(grupo) % 360) * (Math.PI / 180)
      const radio = 0.011 * Math.sqrt(indice + 0.6)
      indice++
      const lat = centro[0] + radio * Math.cos(angulo)
      const lng = centro[1] + (radio * Math.sin(angulo)) / Math.cos((centro[0] * Math.PI) / 180)
      puntos.push({ ...base, lat, lng, aproximado: true })
    }
  }
  return puntos
}

export type GrupoMunicipio = { grupo: string; municipio: string; departamento: string; lng: number; lat: number; puntos: PuntoOrigen[] }

export function agruparPorMunicipio(puntos: PuntoOrigen[]): GrupoMunicipio[] {
  const grupos = new Map<string, PuntoOrigen[]>()
  for (const punto of puntos) grupos.set(punto.grupo, [...(grupos.get(punto.grupo) ?? []), punto])
  return [...grupos.entries()].map(([grupo, lista]) => ({
    grupo,
    municipio: lista[0].municipio,
    departamento: lista[0].departamento,
    lng: lista.reduce((s, p) => s + p.lng, 0) / lista.length,
    lat: lista.reduce((s, p) => s + p.lat, 0) / lista.length,
    puntos: lista,
  }))
}

// ---------------------------------------------------------------------------
// Etapas de beneficio: el backend las guarda como texto libre (ej. "SECADO").

const ETAPAS_EN: Record<string, string> = {
  RECOLECCION: 'Picking',
  COSECHA: 'Harvest',
  DESPULPADO: 'Pulping',
  FERMENTACION: 'Fermentation',
  LAVADO: 'Washing',
  SECADO: 'Drying',
  TRILLA: 'Hulling',
  CLASIFICACION: 'Sorting',
  TOSTION: 'Roasting',
  TOSTADO: 'Roasting',
  MOLIENDA: 'Grinding',
  EMPAQUE: 'Packing',
  EMPACADO: 'Packing',
  BENEFICIO: 'Processing',
  NATURAL: 'Natural',
  HONEY: 'Honey',
}

export function etapaVisible(etapa: string, idioma: Idioma) {
  const clave = normalizar(etapa).replace(/[\s-]+/g, '_')
  if (idioma === 'en') {
    const traducida = clave.split('_').map((parte) => ETAPAS_EN[parte] ?? nombreVisible(parte)).join(' ')
    if (traducida) return traducida
  }
  return nombreVisible(etapa.replace(/_/g, ' '))
}

/** Pasos de la cadena que la finca ya documentó (para la barra de progreso de la tarjeta). */
export function pasosDocumentados(t: TrazaOrigen) {
  const lotes = 'lotsCount' in t ? t.lotsCount > 0 : Boolean(t.crop || t.harvest)
  const labores = Object.entries(t.practices.laborsByType).some(([tipo, n]) => tipo !== 'COSECHA' && (n ?? 0) > 0)
  const productos = t.processes.flatMap((p) => p.products)
  return [
    { clave: 'finca', hecho: true },
    { clave: 'lotes', hecho: lotes },
    { clave: 'cultivo', hecho: Boolean(t.crop) || ('cropsCount' in t && t.cropsCount > 0) },
    { clave: 'labores', hecho: labores },
    { clave: 'suelo', hecho: t.practices.soilAnalyses > 0 },
    { clave: 'bioinsumos', hecho: t.practices.bioinputApplications > 0 },
    { clave: 'cosecha', hecho: Boolean(t.harvest) },
    { clave: 'proceso', hecho: t.processes.length > 0 },
    { clave: 'producto', hecho: productos.length > 0 },
  ] as const
}

// ---------------------------------------------------------------------------
// Textos del explorador en español e inglés.

const ES = {
  kicker: 'Explora el origen',
  titulo: 'Recorre las fincas de Colombia',
  subtitulo: 'Vuela entre montañas, acércate a cada finca y descubre cómo se cultiva y procesa su café.',
  buscar: 'Buscar finca o municipio',
  todas: 'Toda Colombia',
  relieve: 'Relieve',
  satelite: 'Satélite',
  vista3d: '3D',
  colombia: 'Colombia',
  recorrer: 'Recorrer fincas',
  pausar: 'Pausar recorrido',
  anterior: 'Finca anterior',
  siguiente: 'Finca siguiente',
  fincas: (n: number) => `${n} ${n === 1 ? 'finca' : 'fincas'}`,
  publicado: 'Origen publicado',
  registrada: 'Ubicación registrada',
  zonaAproximada: 'Zona aproximada · ubicación exacta protegida',
  ubicacionCompartida: 'Ubicación compartida por la finca',
  tipo: 'Tipo de finca',
  cultivo: 'Cultivo',
  lotes: 'Lotes',
  cosechas: 'Cosechas',
  ultimaCosecha: 'Última cosecha',
  proceso: 'Proceso actual',
  practicas: 'Prácticas',
  labores: (n: number) => `${n} ${n === 1 ? 'labor' : 'labores'}`,
  suelos: (n: number) => `${n} análisis de suelo`,
  bioinsumos: (n: number) => `${n} ${n === 1 ? 'bioinsumo' : 'bioinsumos'}`,
  sinDatos: 'Aún sin registrar',
  recorrido: 'Recorrido documentado',
  pasos: (h: number, t: number) => `${h} de ${t} etapas`,
  cargando: 'Cargando lo que ha documentado la finca…',
  sinTraza: 'No se pudo cargar la información de esta finca.',
  verHistoria: 'Ver historia completa',
  certificaciones: 'Certificaciones',
  pistaInicio: 'Toca un municipio para acercarte o pulsa “Recorrer fincas”.',
  pistaCerca: 'Pasa el cursor o toca una finca para ver su información.',
  clicMas: 'Clic para ver más',
  sinMapa: 'El mapa 3D no está disponible en este navegador. Puedes recorrer las fincas en la lista.',
  cargandoFincas: 'Cargando fincas…',
  errorFincas: 'No se pudieron cargar los orígenes. Intenta más tarde.',
  vacio: 'No hay fincas que coincidan con la búsqueda.',
  cerrar: 'Cerrar',
  tipos: { CONVENCIONAL: 'Convencional', EN_TRANSICION: 'En transición', REGENERATIVA: 'Regenerativa' } as Record<string, string>,
  idioma: 'English',
  leyenda: 'Cada punto es una finca. Por privacidad, se muestran en una zona aproximada de su municipio.',
}

export type Textos = typeof ES

const EN: Textos = {
  kicker: 'Explore the origin',
  titulo: 'Travel through Colombia’s coffee farms',
  subtitulo: 'Fly across the mountains, zoom into each farm and discover how its coffee is grown and processed.',
  buscar: 'Search farm or town',
  todas: 'All of Colombia',
  relieve: 'Terrain',
  satelite: 'Satellite',
  vista3d: '3D',
  colombia: 'Colombia',
  recorrer: 'Tour the farms',
  pausar: 'Pause tour',
  anterior: 'Previous farm',
  siguiente: 'Next farm',
  fincas: (n: number) => `${n} ${n === 1 ? 'farm' : 'farms'}`,
  publicado: 'Published origin',
  registrada: 'Registered location',
  zonaAproximada: 'Approximate area · exact location protected',
  ubicacionCompartida: 'Location shared by the farm',
  tipo: 'Farming approach',
  cultivo: 'Crop',
  lotes: 'Plots',
  cosechas: 'Harvests',
  ultimaCosecha: 'Latest harvest',
  proceso: 'Current process',
  practicas: 'Practices',
  labores: (n: number) => `${n} field ${n === 1 ? 'task' : 'tasks'}`,
  suelos: (n: number) => `${n} soil ${n === 1 ? 'analysis' : 'analyses'}`,
  bioinsumos: (n: number) => `${n} ${n === 1 ? 'bio-input' : 'bio-inputs'}`,
  sinDatos: 'Not recorded yet',
  recorrido: 'Documented journey',
  pasos: (h: number, t: number) => `${h} of ${t} stages`,
  cargando: 'Loading what this farm has documented…',
  sinTraza: 'Could not load this farm’s information.',
  verHistoria: 'See the full story',
  certificaciones: 'Certifications',
  pistaInicio: 'Tap a town to zoom in, or press “Tour the farms”.',
  pistaCerca: 'Hover or tap a farm to see its details.',
  clicMas: 'Click for more',
  sinMapa: 'The 3D map is not available in this browser. You can still browse the farms in the list.',
  cargandoFincas: 'Loading farms…',
  errorFincas: 'Origins could not be loaded. Please try again later.',
  vacio: 'No farms match your search.',
  cerrar: 'Close',
  tipos: { CONVENCIONAL: 'Conventional', EN_TRANSICION: 'In transition', REGENERATIVA: 'Regenerative' } as Record<string, string>,
  idioma: 'Español',
  leyenda: 'Each dot is a farm. For privacy, farms are shown within an approximate area of their town.',
}

export const TEXTOS: Record<Idioma, Textos> = { es: ES, en: EN }
