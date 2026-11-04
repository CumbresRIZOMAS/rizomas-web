import { normalizar, nombreVisible, type Idioma } from './origenesMapa'

// Capas de contexto del explorador: datos abiertos sobre café y naturaleza
// generados por scripts/datos-mapa/generar.py en public/mapa/.

export type CapaId = 'produccion' | 'denominaciones' | 'pcc' | 'puertos' | 'destinos' | 'paramos' | 'protegidas' | 'rios'

export type CafeDatos = {
  naturaleza: { areasProtegidas: number; reservasCiviles: number; parquesNacionales: number; paramos: number; paramosHa: number }
  produccion: { anio: number; toneladas: number; hectareas: number; municipios: number; departamentos: { d: string; t: number; h: number; n: number }[] }
  exportaciones: {
    anio: number
    sacos: number
    usd: number
    paises: number
    tipos: Record<string, number>
    destinos: { es: string; en: string; lat: number; lng: number; sacos: number; usd: number }[]
    puertos: { n: string; lat: number; lng: number; sacos: number }[]
  }
}

export type MunicipioCafe = { c: string; m: string; d: string; t: number; h: number; r: number; dop?: DopId; pcc?: 1 }
export type DopId = 'huila' | 'cauca' | 'narino' | 'santander' | 'sierra' | 'tolima'

export type Contexto =
  | { tipo: 'municipio'; datos: MunicipioCafe }
  | { tipo: 'dop'; id: DopId }
  | { tipo: 'pcc' }
  | { tipo: 'paramo'; nombre: string; ha: number; resolucion: string | null }
  | { tipo: 'protegida'; nombre: string; categoria: string; ha: number; organizacion: string | null; url: string | null }
  | { tipo: 'puerto'; nombre: string; sacos: number }
  | { tipo: 'destino'; es: string; en: string; sacos: number; usd: number }
  | { tipo: 'exportaciones' }
  | { tipo: 'rio'; nombre: string }

export const BASE_DATOS = '/mapa'

export const GRUPOS_CAPAS: { grupo: 'cafe' | 'naturaleza' | 'mundo'; capas: CapaId[] }[] = [
  { grupo: 'cafe', capas: ['produccion', 'denominaciones', 'pcc', 'puertos'] },
  { grupo: 'naturaleza', capas: ['protegidas', 'paramos', 'rios'] },
  { grupo: 'mundo', capas: ['destinos'] },
]

export const COLOR_CAPA: Record<CapaId, string> = {
  produccion: '#c9852c',
  denominaciones: '#b5577a',
  pcc: '#e2b65c',
  puertos: '#f0c66d',
  destinos: '#f0c66d',
  paramos: '#8fa8d6',
  protegidas: '#4f9a4a',
  rios: '#3f8fd2',
}

export const COLOR_DOP: Record<DopId, string> = {
  huila: '#d9734e',
  cauca: '#b5577a',
  narino: '#7d6bc2',
  santander: '#3f9b8f',
  sierra: '#5b8c3a',
  tolima: '#c7a03a',
}

// Escala de producción por municipio (toneladas de café pergamino seco al año).
export const ESCALA_PRODUCCION: [number, string][] = [
  [0, '#f7ecd0'],
  [500, '#ecc978'],
  [2000, '#d99a3c'],
  [6000, '#a8611f'],
  [15000, '#5a2c0b'],
]

type Texto = Record<Idioma, string>

/** Denominaciones de origen regionales (textos oficiales de cafedecolombia.com, resumidos). */
export const DENOMINACIONES: Record<DopId, { nombre: string; resolucion: Texto; perfil: Texto; porque?: Texto; zona?: Texto; dato?: { texto: Texto; fuente: string } }> = {
  huila: {
    nombre: 'Café de Huila',
    resolucion: { es: 'Protegida por la SIC, Resolución 17989 del 16 de abril de 2013', en: 'Protected by Colombia’s SIC, Resolution 17989 of 16 April 2013' },
    perfil: {
      es: 'Impresión global balanceada, notas dulces, acidez y cuerpo medio/alto; fragancia y aroma intensos con sensaciones frutales y acarameladas.',
      en: 'Balanced overall impression, sweet notes, medium-to-high acidity and body; intense fragrance and aroma with fruity, caramel-like sensations.',
    },
    porque: {
      es: 'Pocas horas de sol por la nubosidad (3,5 h/día) y temperaturas constantes que favorecen la acumulación de compuestos en el fruto, entre 1.000 y 2.200 m de altura.',
      en: 'Few sunshine hours due to cloud cover (3.5 h/day) and steady temperatures that help the cherry accumulate compounds, between 1,000 and 2,200 m above sea level.',
    },
  },
  cauca: {
    nombre: 'Café de Cauca',
    resolucion: { es: 'Protegida por la SIC, Resolución 41788 del 10 de agosto de 2011', en: 'Protected by Colombia’s SIC, Resolution 41788 of 10 August 2011' },
    perfil: {
      es: 'Acidez alta, cuerpo medio, taza limpia y suave con notas dulces y florales, y aromas muy fuertes y acaramelados.',
      en: 'High acidity, medium body, a clean and smooth cup with sweet and floral notes, and very strong, caramel-like aromas.',
    },
    porque: {
      es: 'Más horas de sol, clima constante todo el año y altas montañas que protegen los cafetales de los vientos y la humedad del Pacífico.',
      en: 'More sunshine hours, a steady climate all year and high mountains that shelter the farms from Pacific winds and humidity.',
    },
  },
  narino: {
    nombre: 'Café de Nariño',
    resolucion: { es: 'Protegida por la SIC, Resolución 6093 del 11 de febrero de 2011', en: 'Protected by Colombia’s SIC, Resolution 6093 of 11 February 2011' },
    perfil: {
      es: 'Alta acidez, cuerpo medio, notas dulces, taza limpia y suave, y aroma muy pronunciado.',
      en: 'High acidity, medium body, sweet notes, a clean and smooth cup, and a very pronounced aroma.',
    },
    porque: {
      es: 'Suelos con mucha materia orgánica, grandes alturas y bajas temperaturas que obligan a la planta a conservar sus azúcares.',
      en: 'Soils rich in organic matter, great altitudes and low temperatures that force the plant to keep its sugars.',
    },
  },
  santander: {
    nombre: 'Café de Santander',
    resolucion: { es: 'Protegida por la SIC, Resolución 50042 del 25 de agosto de 2014', en: 'Protected by Colombia’s SIC, Resolution 50042 of 25 August 2014' },
    perfil: {
      es: 'Taza limpia y balanceada, cuerpo medio-alto, acidez media, sabores dulces, herbales y frutales con ligeras sensaciones cítricas.',
      en: 'Clean, balanced cup with medium-to-high body, medium acidity, sweet, herbal and fruity flavours with light citrus hints.',
    },
    porque: {
      es: 'Cultivo bajo sombra: temperaturas homogéneas y una maduración más lenta del fruto que acumula azúcares.',
      en: 'Shade-grown coffee: even temperatures and slower ripening that lets the cherry build up sugars.',
    },
  },
  sierra: {
    nombre: 'Café de la Sierra Nevada',
    resolucion: { es: 'Protegida por la SIC, Resolución 2484 del 30 de enero de 2017', en: 'Protected by Colombia’s SIC, Resolution 2484 of 30 January 2017' },
    zona: { es: '33 municipios de Magdalena, La Guajira y Cesar (zona aproximada en el mapa).', en: '33 municipalities in Magdalena, La Guajira and Cesar (approximate area on the map).' },
    perfil: {
      es: 'Taza limpia y balanceada, cuerpo medio-alto y uniforme, acidez media y sabores que recuerdan al chocolate; fragancia con notas dulces y anuezadas.',
      en: 'Clean, balanced cup with an even medium-to-high body, medium acidity and chocolate-like flavours; sweet, nutty fragrance.',
    },
    porque: {
      es: 'Alta luminosidad y pocas lluvias: el café se siembra bajo sombrío total, en suelos arcillosos y con alta humedad.',
      en: 'Bright sunlight and little rain: coffee is grown under full shade, on clay soils with high humidity.',
    },
    dato: {
      texto: { es: 'Cerca del 70 % de quienes cultivan este café pertenecen al pueblo arhuaco.', en: 'About 70% of the growers of this coffee belong to the Arhuaco people.' },
      fuente: 'colombia.travel',
    },
  },
  tolima: {
    nombre: 'Café de Tolima',
    resolucion: { es: 'Protegida por la SIC, Resolución 2458 del 30 de enero de 2017', en: 'Protected by Colombia’s SIC, Resolution 2458 of 30 January 2017' },
    zona: { es: '38 municipios productores del Tolima.', en: '38 coffee-growing municipalities in Tolima.' },
    perfil: {
      es: 'Acidez y cuerpo medio-altos, taza limpia, suave y balanceada, con sabores dulces.',
      en: 'Medium-to-high acidity and body; a clean, smooth, balanced cup with sweet flavours.',
    },
  },
}

const DOP_POR_DEPARTAMENTO: Record<string, DopId> = { HUILA: 'huila', CAUCA: 'cauca', NARINO: 'narino', SANTANDER: 'santander', TOLIMA: 'tolima' }
const DEPARTAMENTOS_PCC = new Set(['CALDAS', 'QUINDIO', 'RISARALDA', 'VALLE DEL CAUCA'])

export function dopDeDepartamento(departamento: string): DopId | null {
  return DOP_POR_DEPARTAMENTO[normalizar(departamento)] ?? null
}

export function departamentoEnPcc(departamento: string) {
  return DEPARTAMENTOS_PCC.has(normalizar(departamento))
}

/** Descripción breve de los ríos que atraviesan las zonas cafeteras. */
export const RIOS: Record<string, Record<Idioma, string>> = {
  Magdalena: {
    es: 'El río más importante de Colombia. Nace en el Macizo Colombiano, al sur del Huila, y cruza el país de sur a norte hasta el mar Caribe.',
    en: 'Colombia’s most important river. It rises in the Colombian Massif, in southern Huila, and crosses the country from south to north to the Caribbean Sea.',
  },
  Cauca: {
    es: 'Nace en el Macizo Colombiano y recorre los valles del occidente, pasando junto al Eje Cafetero, hasta unirse al Magdalena.',
    en: 'It rises in the Colombian Massif and runs through the western valleys, past the Coffee Axis, until it joins the Magdalena.',
  },
}

export const TEXTOS_CAPAS = {
  es: {
    capas: 'Capas',
    grupos: { cafe: 'Café', naturaleza: 'Naturaleza', mundo: 'Al mundo' },
    nombres: {
      produccion: 'Producción por municipio',
      denominaciones: 'Denominaciones de origen',
      pcc: 'Paisaje Cultural Cafetero',
      puertos: 'Puertos de exportación',
      destinos: 'Destinos del café',
      paramos: 'Páramos',
      protegidas: 'Áreas protegidas',
      rios: 'Ríos principales',
    } satisfies Record<CapaId, string>,
    ayudas: {
      produccion: 'Toneladas de café por municipio',
      denominaciones: 'Regiones con perfil de taza protegido',
      pcc: 'Patrimonio de la Humanidad, UNESCO',
      puertos: 'Por dónde sale el café al mundo',
      destinos: 'Vista de globo con los países compradores',
      paramos: 'Ecosistemas de alta montaña que regulan el agua',
      protegidas: 'Parques y reservas del RUNAP',
      rios: 'Grandes ríos del país',
    } satisfies Record<CapaId, string>,
    sabias: '¿Sabías que…?',
    verMapa: 'Ver en el mapa',
    fuentes: 'Fuentes',
    toneladas: (t: number) => `${formatear(t, 'es')} t`,
    sacos: (s: number) => `${formatear(s, 'es')} sacos de 60 kg`,
    hectareas: (h: number) => `${formatear(h, 'es')} ha`,
    usd: (u: number) => `US$${formatear(Math.round(u / 1e6), 'es')} millones`,
    municipioKicker: 'Municipio cafetero',
    puesto: (r: number, n: number) => `Puesto ${r} de ${n} en producción de café`,
    produccionAnio: (a: number) => `Producción ${a}`,
    sembradas: 'Área sembrada',
    perfil: 'Perfil de taza',
    porque: 'Por qué es especial',
    zona: 'Zona',
    dopKicker: 'Denominación de origen',
    pccKicker: 'Patrimonio de la Humanidad',
    pccTitulo: 'Paisaje Cultural Cafetero',
    pccTexto: 'La UNESCO lo reconoció en 2011 por la tradición de cultivar café en pequeñas fincas de montaña. Abarca zonas rurales de municipios de Caldas, Quindío, Risaralda y Valle del Cauca.',
    paramoKicker: 'Complejo de páramo',
    paramoTexto: 'Ecosistema de alta montaña que capta y regula el agua que baja hacia los valles y las zonas cafeteras.',
    delimitacion: 'Delimitación',
    protegidaKicker: 'Área protegida',
    administra: 'Administra',
    verRunap: 'Ver ficha en el RUNAP',
    puertoKicker: 'Puerto de exportación',
    puertoTexto: (a: number) => `Café exportado por aquí en ${a}`,
    destinoKicker: 'Destino del café colombiano',
    destinoTexto: (a: number) => `Compras de café colombiano en ${a}`,
    rioKicker: 'Río',
    expoKicker: 'Del cafetal al mundo',
    expoTitulo: (a: number) => `Exportaciones de café ${a}`,
    expoResumen: (s: string, p: number, u: string) => `${s} millones de sacos de 60 kg a ${p} países, por ${u}.`,
    expoTipos: 'Cómo sale',
    expoTop: 'Países que más compran',
    tipos: { 'Café Verde': 'Café verde', Soluble: 'Soluble', Tostados: 'Tostado', Extractos: 'Extractos' } as Record<string, string>,
    leyendaProduccion: 'Toneladas de café pergamino seco por municipio',
    enMunicipio: 'En su municipio',
    deTotal: (p: string) => `${p} % del total exportado`,
    datoTitulo: 'Dato',
  },
  en: {
    capas: 'Layers',
    grupos: { cafe: 'Coffee', naturaleza: 'Nature', mundo: 'To the world' },
    nombres: {
      produccion: 'Production by town',
      denominaciones: 'Designations of origin',
      pcc: 'Coffee Cultural Landscape',
      puertos: 'Export ports',
      destinos: 'Where the coffee goes',
      paramos: 'Páramos (high moorlands)',
      protegidas: 'Protected areas',
      rios: 'Main rivers',
    } satisfies Record<CapaId, string>,
    ayudas: {
      produccion: 'Tonnes of coffee per town',
      denominaciones: 'Regions with a protected cup profile',
      pcc: 'UNESCO World Heritage',
      puertos: 'Where coffee leaves for the world',
      destinos: 'Globe view of buyer countries',
      paramos: 'High-mountain ecosystems that regulate water',
      protegidas: 'Parks and reserves (RUNAP)',
      rios: 'The country’s great rivers',
    } satisfies Record<CapaId, string>,
    sabias: 'Did you know…?',
    verMapa: 'Show on map',
    fuentes: 'Sources',
    toneladas: (t: number) => `${formatear(t, 'en')} t`,
    sacos: (s: number) => `${formatear(s, 'en')} 60-kg bags`,
    hectareas: (h: number) => `${formatear(h, 'en')} ha`,
    usd: (u: number) => `US$${formatear(Math.round(u / 1e6), 'en')} million`,
    municipioKicker: 'Coffee-growing town',
    puesto: (r: number, n: number) => `Ranked ${r} of ${n} in coffee production`,
    produccionAnio: (a: number) => `${a} production`,
    sembradas: 'Planted area',
    perfil: 'Cup profile',
    porque: 'What makes it special',
    zona: 'Area',
    dopKicker: 'Designation of origin',
    pccKicker: 'World Heritage',
    pccTitulo: 'Coffee Cultural Landscape',
    pccTexto: 'Recognised by UNESCO in 2011 for its tradition of growing coffee on small mountain farms. It spans rural areas of towns in Caldas, Quindío, Risaralda and Valle del Cauca.',
    paramoKicker: 'Páramo complex',
    paramoTexto: 'A high-mountain ecosystem that captures and regulates the water flowing down to the valleys and coffee lands.',
    delimitacion: 'Delimitation',
    protegidaKicker: 'Protected area',
    administra: 'Managed by',
    verRunap: 'Open RUNAP record',
    puertoKicker: 'Export port',
    puertoTexto: (a: number) => `Coffee shipped from here in ${a}`,
    destinoKicker: 'Destination of Colombian coffee',
    destinoTexto: (a: number) => `Colombian coffee bought in ${a}`,
    rioKicker: 'River',
    expoKicker: 'From farm to the world',
    expoTitulo: (a: number) => `Coffee exports ${a}`,
    expoResumen: (s: string, p: number, u: string) => `${s} million 60-kg bags to ${p} countries, worth ${u}.`,
    expoTipos: 'How it ships',
    expoTop: 'Top buyer countries',
    tipos: { 'Café Verde': 'Green coffee', Soluble: 'Soluble', Tostados: 'Roasted', Extractos: 'Extracts' } as Record<string, string>,
    leyendaProduccion: 'Tonnes of dry parchment coffee per town',
    enMunicipio: 'In its town',
    deTotal: (p: string) => `${p}% of all exports`,
    datoTitulo: 'Fact',
  },
}

export type TextosCapas = (typeof TEXTOS_CAPAS)['es']

export function formatear(n: number, idioma: Idioma, decimales = 0) {
  return n.toLocaleString(idioma === 'es' ? 'es-CO' : 'en-US', { maximumFractionDigits: decimales })
}

// ---------------------------------------------------------------------------
// "¿Sabías que…?": datos calculados de las fuentes, cada uno con su acción.

export type Accion = { capas: CapaId[]; vista: 'colombia' | 'mundo' | { centro: [number, number]; zoom: number } }
export type Dato = { id: string; texto: string; accion: Accion; fuente: string }

export function datosCuriosos(
  d: CafeDatos,
  idioma: Idioma,
  extra: { municipioTop?: { nombre: string; centro: [number, number] } | null; fincasEnTop?: number },
): Dato[] {
  const f = (n: number, dec = 0) => formatear(n, idioma, dec)
  const p = d.produccion
  const e = d.exportaciones
  const deps = p.departamentos
  const topDep = deps[0]
  const pctDep = Math.round((topDep.t / p.toneladas) * 100)
  const topDestino = e.destinos[0]
  const pctDestino = Math.round((topDestino.sacos / e.sacos) * 100)
  const topPuerto = e.puertos[0]
  const pctPuerto = Math.round((topPuerto.sacos / e.sacos) * 100)
  const fuenteEva = `UPRA · EVA ${p.anio}`
  const fuenteFnc = `FNC · ${e.anio}`
  const es = idioma === 'es'
  const datos: Dato[] = [
    {
      id: 'produccion',
      texto: es
        ? `En ${p.anio}, Colombia produjo ${f(p.toneladas)} toneladas de café pergamino seco en ${f(p.municipios)} municipios.`
        : `In ${p.anio}, Colombia produced ${f(p.toneladas)} tonnes of dry parchment coffee across ${f(p.municipios)} towns.`,
      accion: { capas: ['produccion'], vista: 'colombia' },
      fuente: fuenteEva,
    },
  ]
  if (extra.municipioTop) {
    const lugar = extra.municipioTop.nombre
    const fincas = extra.fincasEnTop ?? 0
    datos.push({
      id: 'municipio-top',
      texto: es
        ? `${lugar} es el municipio que más café produce en Colombia.${fincas ? ` Allí están ${fincas} de las fincas de este mapa.` : ''}`
        : `${lugar} is the town that produces the most coffee in Colombia.${fincas ? ` ${fincas} of the farms on this map are there.` : ''}`,
      accion: { capas: ['produccion'], vista: { centro: extra.municipioTop.centro, zoom: 9.5 } },
      fuente: fuenteEva,
    })
  }
  datos.push(
    {
      id: 'departamento-top',
      texto: es
        ? `${nombreVisible(topDep.d)} aporta el ${pctDep} % del café del país: es el departamento que más produce.`
        : `${nombreVisible(topDep.d)} grows ${pctDep}% of the country’s coffee, more than any other department.`,
      accion: { capas: ['produccion'], vista: 'colombia' },
      fuente: fuenteEva,
    },
    {
      id: 'exportaciones',
      texto: es
        ? `En ${e.anio} Colombia exportó ${f(e.sacos / 1e6, 1)} millones de sacos de café a ${e.paises} países. ${topDestino.es} compró el ${pctDestino} %.`
        : `In ${e.anio} Colombia exported ${f(e.sacos / 1e6, 1)} million bags of coffee to ${e.paises} countries. The ${topDestino.en} bought ${pctDestino}%.`,
      accion: { capas: ['destinos'], vista: 'mundo' },
      fuente: fuenteFnc,
    },
    {
      id: 'puerto',
      texto: es
        ? `${pctPuerto} % del café exportado sale por ${topPuerto.n}${topPuerto.n === 'Buenaventura' ? ', en el Pacífico' : ''}.`
        : `${pctPuerto}% of exported coffee leaves through ${topPuerto.n}${topPuerto.n === 'Buenaventura' ? ', on the Pacific coast' : ''}.`,
      accion: { capas: ['puertos'], vista: 'colombia' },
      fuente: fuenteFnc,
    },
    {
      id: 'dop',
      texto: es
        ? 'Seis regiones tienen denominación de origen propia: su perfil de taza está protegido por ley.'
        : 'Six regions have their own designation of origin: their cup profile is protected by law.',
      accion: { capas: ['denominaciones'], vista: 'colombia' },
      fuente: 'cafedecolombia.com',
    },
    {
      id: 'pcc',
      texto: es
        ? 'El Paisaje Cultural Cafetero es Patrimonio de la Humanidad de la UNESCO desde 2011.'
        : 'The Coffee Cultural Landscape has been a UNESCO World Heritage site since 2011.',
      accion: { capas: ['pcc'], vista: { centro: [-75.65, 4.9], zoom: 7.6 } },
      fuente: 'UNESCO',
    },
    {
      id: 'paramos',
      texto: es
        ? `Colombia tiene ${d.naturaleza.paramos} complejos de páramo delimitados, con ${f(d.naturaleza.paramosHa / 1e6, 1)} millones de hectáreas: regulan el agua que baja a los valles.`
        : `Colombia has ${d.naturaleza.paramos} delimited páramo complexes covering ${f(d.naturaleza.paramosHa / 1e6, 1)} million hectares; they regulate the water that flows to the valleys.`,
      accion: { capas: ['paramos', 'rios'], vista: 'colombia' },
      fuente: 'MinAmbiente · Humboldt',
    },
    {
      id: 'reservas',
      texto: es
        ? `El país registra ${f(d.naturaleza.areasProtegidas)} áreas protegidas; ${f(d.naturaleza.reservasCiviles)} son reservas privadas creadas por sus propios dueños.`
        : `The country lists ${f(d.naturaleza.areasProtegidas)} protected areas; ${f(d.naturaleza.reservasCiviles)} are private reserves created by their own landowners.`,
      accion: { capas: ['protegidas'], vista: 'colombia' },
      fuente: 'RUNAP · PNN',
    },
  )
  return datos
}

// ---------------------------------------------------------------------------
// Utilidades geográficas.

/** Puntos de un arco de gran círculo entre dos coordenadas [lng, lat]. */
export function granCirculo(a: [number, number], b: [number, number], pasos = 64): [number, number][] {
  const rad = Math.PI / 180
  const [l1, f1] = [a[0] * rad, a[1] * rad]
  const [l2, f2] = [b[0] * rad, b[1] * rad]
  const d = 2 * Math.asin(Math.sqrt(Math.sin((f2 - f1) / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin((l2 - l1) / 2) ** 2))
  if (d === 0) return [a, b]
  const puntos: [number, number][] = []
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos
    const A = Math.sin((1 - t) * d) / Math.sin(d)
    const B = Math.sin(t * d) / Math.sin(d)
    const x = A * Math.cos(f1) * Math.cos(l1) + B * Math.cos(f2) * Math.cos(l2)
    const y = A * Math.cos(f1) * Math.sin(l1) + B * Math.cos(f2) * Math.sin(l2)
    const z = A * Math.sin(f1) + B * Math.sin(f2)
    puntos.push([Math.atan2(y, x) / rad, Math.atan2(z, Math.sqrt(x * x + y * y)) / rad])
  }
  return puntos
}

type Anillo = [number, number][]
type GeometriaPoligono = { type: 'Polygon'; coordinates: Anillo[] } | { type: 'MultiPolygon'; coordinates: Anillo[][] }

/** Punto representativo (centro del anillo exterior más grande) para poner etiquetas. */
export function centroPoligono(geometria: GeometriaPoligono): [number, number] {
  const poligonos = geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.coordinates
  let mejor: Anillo = poligonos[0][0]
  let mayor = -1
  for (const p of poligonos) {
    const anillo = p[0]
    const xs = anillo.map((c) => c[0])
    const ys = anillo.map((c) => c[1])
    const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
    if (area > mayor) {
      mayor = area
      mejor = anillo
    }
  }
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < mejor.length - 1; i++) {
    const [x0, y0] = mejor[i]
    const [x1, y1] = mejor[i + 1]
    const k = x0 * y1 - x1 * y0
    a += k
    cx += (x0 + x1) * k
    cy += (y0 + y1) * k
  }
  if (a === 0) return mejor[0]
  return [cx / (3 * a), cy / (3 * a)]
}
