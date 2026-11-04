import type { CoffeeProcess, CoffeeProcessEvent } from '../../shared/api/types'

// Guía del beneficio del café: tipos de proceso, sus etapas recomendadas y
// qué conviene medir en cada una. El mismo contenido vive en la app móvil
// (rizomas-mobile: lib/domain/proceso_cafe.dart); si cambia uno, cambiar el otro.
//
// El tipo de proceso se guarda en el campo `method` de cada etapa con el
// formato "Honey amarillo · Marquesina" (tipo · técnica), sin cambiar el servidor.

/** Etapas que acepta el servidor, en orden. */
export const ETAPAS_CAFE = ['Cosecha', 'Despulpado', 'Fermentación', 'Lavado', 'Secado', 'Trilla', 'Tostión', 'Catación'] as const
export type EtapaCafe = (typeof ETAPAS_CAFE)[number]
export const ETAPAS_OPCIONALES: EtapaCafe[] = ['Tostión', 'Catación']

export type Campo = 'entrada' | 'salida' | 'horas' | 'dias' | 'minutos' | 'brix' | 'ph' | 'agua' | 'aguaResidual' | 'destinoAgua' | 'humedad' | 'sca' | 'notasSabor'

export type EtapaGuia = {
  nombre: EtapaCafe
  emoji: string
  queEs: string
  consejo: string
  campos: Campo[]
  entradaLabel?: string
  salidaLabel?: string
  tecnicas?: string[]
  horasSugeridas?: number[]
  diasSugeridos?: number[]
}

export type TipoProceso = {
  id: 'lavado' | 'honey' | 'natural' | 'anaerobico'
  nombre: string
  emoji: string
  resumen: string
  taza: string
  duracion: string
  nivel: string
  etapas: EtapaCafe[]
  variantes?: string[]
  recomendado?: boolean
  consejos?: Partial<Record<EtapaCafe, string>>
}

export const GUIA_ETAPAS: Record<EtapaCafe, EtapaGuia> = {
  Cosecha: {
    nombre: 'Cosecha',
    emoji: '🍒',
    queEs: 'Recolección de la cereza madura.',
    consejo: 'Recoge solo cereza madura y separa las verdes y secas: la calidad empieza aquí.',
    campos: ['salida'],
    salidaLabel: 'Cereza recolectada',
  },
  Despulpado: {
    nombre: 'Despulpado',
    emoji: '⚙️',
    queEs: 'Se retira la pulpa y queda el grano con mucílago (café en baba).',
    consejo: 'Despulpa el mismo día de la cosecha, idealmente antes de 6 horas, para evitar fermentaciones no deseadas.',
    campos: ['entrada', 'salida'],
    entradaLabel: 'Cereza que entra',
    salidaLabel: 'Café en baba que sale',
  },
  Fermentación: {
    nombre: 'Fermentación',
    emoji: '🫧',
    queEs: 'El mucílago se descompone para poder lavarlo y aporta sabor.',
    consejo: 'Fermenta hasta el punto de lavado (el grano suena "a cascajo" y el mucílago se desprende). Suele tardar entre 12 y 18 horas según la temperatura.',
    campos: ['horas', 'brix', 'ph'],
    tecnicas: ['Tanque abierto', 'Tanque cerrado', 'Bolsa sellada', 'Con cultivo iniciador'],
    horasSugeridas: [12, 14, 16, 18, 24],
  },
  Lavado: {
    nombre: 'Lavado',
    emoji: '💧',
    queEs: 'Se retira el mucílago con agua limpia.',
    consejo: 'Usa poca agua y nunca viertas las aguas mieles a ríos o quebradas: llévalas a compostaje o a un sistema de tratamiento.',
    campos: ['agua', 'aguaResidual', 'destinoAgua'],
  },
  Secado: {
    nombre: 'Secado',
    emoji: '☀️',
    queEs: 'Se baja la humedad del grano para conservarlo.',
    consejo: 'Seca hasta 10–12 % de humedad, que es lo que pide el mercado. Remueve el café varias veces al día para que seque parejo.',
    campos: ['dias', 'humedad', 'salida'],
    salidaLabel: 'Café seco que sale',
    tecnicas: ['Marquesina', 'Patio', 'Camas africanas', 'Silo mecánico'],
    diasSugeridos: [5, 8, 12, 15, 20],
  },
  Trilla: {
    nombre: 'Trilla',
    emoji: '🫘',
    queEs: 'Se quita el pergamino y queda el café verde (almendra).',
    consejo: 'Anota cuánto entra y cuánto sale para conocer el rendimiento de tu café.',
    campos: ['entrada', 'salida'],
    entradaLabel: 'Pergamino seco que entra',
    salidaLabel: 'Café verde que sale',
  },
  Tostión: {
    nombre: 'Tostión',
    emoji: '🔥',
    queEs: 'El café verde se tuesta y desarrolla aroma y sabor.',
    consejo: 'Al tostar, el café suele perder entre 12 % y 20 % de su peso. Anota el perfil para repetirlo.',
    campos: ['entrada', 'salida', 'minutos'],
    entradaLabel: 'Café verde que entra',
    salidaLabel: 'Café tostado que sale',
    tecnicas: ['Claro', 'Medio', 'Medio oscuro', 'Oscuro'],
  },
  Catación: {
    nombre: 'Catación',
    emoji: '☕',
    queEs: 'Se prueba y califica la taza.',
    consejo: 'Con 80 puntos o más en la escala SCA el café se considera de especialidad.',
    campos: ['sca', 'notasSabor'],
  },
}

export const TIPOS_PROCESO: TipoProceso[] = [
  {
    id: 'lavado',
    nombre: 'Lavado',
    emoji: '💧',
    resumen: 'El proceso tradicional de Colombia: se despulpa, fermenta y lava antes de secar.',
    taza: 'Taza limpia, acidez brillante',
    duracion: '1 a 3 semanas',
    nivel: 'Fácil',
    etapas: ['Cosecha', 'Despulpado', 'Fermentación', 'Lavado', 'Secado', 'Trilla'],
    recomendado: true,
  },
  {
    id: 'honey',
    nombre: 'Honey',
    emoji: '🍯',
    resumen: 'Se despulpa y se seca con parte del mucílago, sin lavar.',
    taza: 'Más dulzor y cuerpo',
    duracion: '2 a 3 semanas',
    nivel: 'Intermedio',
    etapas: ['Cosecha', 'Despulpado', 'Secado', 'Trilla'],
    variantes: ['Amarillo', 'Rojo', 'Negro'],
    consejos: {
      Despulpado: 'No laves el café: el mucílago que queda pegado es el que da el dulzor.',
      Secado: 'Seca en capas delgadas y remueve seguido las primeras horas para que no se pegue ni salga moho. Lleva el grano a 10–12 % de humedad.',
    },
  },
  {
    id: 'natural',
    nombre: 'Natural',
    emoji: '🍒',
    resumen: 'La cereza entera se seca al sol con su pulpa.',
    taza: 'Notas frutales intensas',
    duracion: '3 a 5 semanas',
    nivel: 'Intermedio',
    etapas: ['Cosecha', 'Secado', 'Trilla'],
    consejos: {
      Cosecha: 'Para natural la cereza debe estar muy madura y sana. Retira las que floten en agua: suelen estar vanas o dañadas.',
      Secado: 'La cereza entera tarda más en secar (de 2 a 4 semanas). Usa capas delgadas, remueve varias veces al día y protégela de la lluvia.',
    },
  },
  {
    id: 'anaerobico',
    nombre: 'Anaeróbico',
    emoji: '🧪',
    resumen: 'Fermentación en tanque cerrado, sin oxígeno, controlando el tiempo.',
    taza: 'Perfiles complejos y exóticos',
    duracion: '2 a 4 semanas',
    nivel: 'Avanzado',
    etapas: ['Cosecha', 'Despulpado', 'Fermentación', 'Lavado', 'Secado', 'Trilla'],
    consejos: {
      Fermentación: 'Cierra el tanque con válvula para que salga el gas. Mide °Brix y pH al inicio y al final, y anota la temperatura: así podrás repetir el resultado.',
    },
  },
]

export const EXPLICACION_VARIANTES: Record<string, string> = {
  Amarillo: 'Menos mucílago, seca más rápido. Dulzor suave.',
  Rojo: 'Mucílago medio. Más dulzor y cuerpo.',
  Negro: 'Casi todo el mucílago, seca lento. El más intenso.',
}

export function esEtapa(etapa: string): etapa is EtapaCafe {
  return (ETAPAS_CAFE as readonly string[]).includes(etapa)
}

export function consejoDe(tipo: TipoProceso | null | undefined, etapa: EtapaCafe): string {
  return tipo?.consejos?.[etapa] ?? GUIA_ETAPAS[etapa].consejo
}

/** Reconoce "Honey" o "Honey rojo", pero no textos libres como "Lavado de recirculación". */
function leerTipo(texto: string): { tipo: TipoProceso | null; variante: string | null } {
  const t = texto.trim().toLowerCase()
  for (const tipo of TIPOS_PROCESO) {
    const nombre = tipo.nombre.toLowerCase()
    if (t === nombre) return { tipo, variante: null }
    for (const v of tipo.variantes ?? []) if (t === `${nombre} ${v.toLowerCase()}`) return { tipo, variante: v }
  }
  return { tipo: null, variante: null }
}

/** "Honey amarillo · Marquesina" → tipo Honey, variante Amarillo, técnica Marquesina. */
export function leerMetodo(metodo: string | null | undefined): { tipo: TipoProceso | null; variante: string | null; tecnica: string | null } {
  if (!metodo?.trim()) return { tipo: null, variante: null, tecnica: null }
  const partes = metodo.split(' · ')
  const { tipo, variante } = leerTipo(partes[0])
  if (!tipo) return { tipo: null, variante: null, tecnica: metodo.trim() }
  return { tipo, variante, tecnica: partes.length > 1 ? partes.slice(1).join(' · ') : null }
}

export function escribirMetodo(tipo: TipoProceso, variante?: string | null, tecnica?: string | null): string {
  const base = variante ? `${tipo.nombre} ${variante.toLowerCase()}` : tipo.nombre
  return tecnica ? `${base} · ${tecnica}` : base
}

function eventosOrdenados(p: Pick<CoffeeProcess, 'events'>): CoffeeProcessEvent[] {
  return [...(p.events ?? [])].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
}

/** Tipo del proceso, tomado de la etapa más reciente que lo tenga. */
export function tipoDeProceso(p: Pick<CoffeeProcess, 'events'>): { tipo: TipoProceso | null; variante: string | null } {
  for (const e of eventosOrdenados(p).reverse()) {
    const m = leerMetodo(e.method)
    if (m.tipo) return { tipo: m.tipo, variante: m.variante }
  }
  return { tipo: null, variante: null }
}

export function etapasHechas(p: Pick<CoffeeProcess, 'events'>): Set<string> {
  return new Set((p.events ?? []).map((e) => e.stage))
}

/** Etapas de la línea de tiempo: las del tipo más cualquiera registrada fuera de él. */
export function rutaDe(p: Pick<CoffeeProcess, 'events'>): EtapaCafe[] {
  const base = tipoDeProceso(p).tipo?.etapas ?? ETAPAS_CAFE.slice(0, 6)
  const hechas = etapasHechas(p)
  return ETAPAS_CAFE.filter((e) => base.includes(e) || hechas.has(e))
}

/** Siguiente etapa recomendada que aún no se ha registrado. */
export function siguienteEtapa(p: Pick<CoffeeProcess, 'events' | 'finishedAt' | 'currentStage'>): EtapaCafe | null {
  if (p.finishedAt) return null
  const hechas = etapasHechas(p)
  const eventos = eventosOrdenados(p)
  // La etapa actual cuenta como avance aunque no tenga mediciones registradas.
  const ultima = Math.max(
    eventos.length ? ETAPAS_CAFE.indexOf(eventos[eventos.length - 1].stage as EtapaCafe) : -1,
    ETAPAS_CAFE.indexOf(p.currentStage as EtapaCafe),
  )
  for (const e of rutaDe(p)) if (!hechas.has(e) && ETAPAS_CAFE.indexOf(e) > ultima) return e
  for (const e of ETAPAS_OPCIONALES) if (!hechas.has(e)) return e
  return null
}

export function avanceDe(p: Pick<CoffeeProcess, 'events'>): number {
  const ruta = rutaDe(p)
  const hechas = etapasHechas(p)
  return ruta.length ? ruta.filter((e) => hechas.has(e)).length / ruta.length : 0
}

/** Última salida en kg (entrada sugerida para la siguiente etapa). */
export function ultimaSalida(p: Pick<CoffeeProcess, 'events'>): number | null {
  for (const e of eventosOrdenados(p).reverse()) if (e.outputKg != null && e.outputKg !== '') return Number(e.outputKg)
  return null
}
