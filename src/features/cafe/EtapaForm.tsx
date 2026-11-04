import { useState, type FormEvent, type ReactNode } from 'react'
import { optionalText, parseOptionalNumber } from '../../shared/format'
import { Button, ErrorNotice, Icon } from '../../shared/ui'
import {
  ETAPAS_OPCIONALES,
  GUIA_ETAPAS,
  TIPOS_PROCESO,
  consejoDe,
  escribirMetodo,
  type Campo,
  type EtapaCafe,
  type TipoProceso,
} from './guiaBeneficio'

const DESTINOS_AGUA = ['Compostaje', 'Sistema de tratamiento', 'Riego de cultivos', 'Otro']
const NOTAS_SABOR = ['Chocolate', 'Panela', 'Caramelo', 'Frutal', 'Floral', 'Cítrico', 'Nuez', 'Especiado']

/** Cuerpo que acepta POST /coffee-processes/:id/events. */
export type EventoPayload = {
  stage: EtapaCafe
  recordedAt: string
  inputKg?: number
  outputKg?: number
  waterLiters?: number
  wastewaterLiters?: number
  compostReuse: boolean
  wastewaterDestination?: string
  durationHours?: number
  method: string
  brix?: number
  ph?: number
  moisturePercent?: number
  scaScore?: number
  notes?: string
}

/** Fecha local (YYYY-MM-DD); toISOString daría la de mañana después de las 7 p. m. en Colombia. */
function hoy(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function redondear(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/**
 * Formulario guiado de una etapa del proceso de café. Muestra lo recomendado
 * para el tipo de proceso, pide solo los datos que tienen sentido en esa
 * etapa y calcula al vuelo rendimiento, merma, agua por kilo y humedad.
 */
export function EtapaForm({
  tipoInicial,
  variante,
  etapaInicial,
  hechas,
  entradaSugerida,
  guardando,
  error,
  textoGuardar,
  onSubmit,
  onCancel,
}: {
  tipoInicial: TipoProceso | null
  variante?: string | null
  etapaInicial: EtapaCafe
  hechas: Set<string>
  entradaSugerida: number | null
  guardando: boolean
  error: string | null
  textoGuardar?: (etapa: EtapaCafe) => string
  onSubmit: (payload: EventoPayload) => void
  onCancel: () => void
}) {
  const [tipo, setTipo] = useState<TipoProceso | null>(tipoInicial)
  const [etapa, setEtapa] = useState<EtapaCafe>(etapaInicial)
  const [tecnica, setTecnica] = useState<string | null>(null)
  const [fecha, setFecha] = useState(hoy())
  const [v, setV] = useState<Partial<Record<Campo, string>>>(() => {
    if (entradaSugerida == null) return {}
    // En la cosecha no hay entrada: lo sugerido (la cosecha asociada) es lo recolectado.
    return GUIA_ETAPAS[etapaInicial].campos.includes('entrada') ? { entrada: redondear(entradaSugerida) } : etapaInicial === 'Cosecha' ? { salida: redondear(entradaSugerida) } : {}
  })
  const [destino, setDestino] = useState<string | null>(null)
  const [destinoOtro, setDestinoOtro] = useState('')
  const [sca, setSca] = useState<number | null>(null)
  const [sabores, setSabores] = useState<string[]>([])
  const [nota, setNota] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)

  const guia = GUIA_ETAPAS[etapa]
  const pide = (c: Campo) => guia.campos.includes(c)
  const num = (c: Campo) => parseOptionalNumber(v[c] ?? '')
  const ruta: EtapaCafe[] = [...(tipo?.etapas ?? (['Cosecha', 'Despulpado', 'Fermentación', 'Lavado', 'Secado', 'Trilla'] as EtapaCafe[])), ...ETAPAS_OPCIONALES]
  const set = (c: Campo) => (valor: string) => setV((x) => ({ ...x, [c]: valor }))

  function cambiarEtapa(e: EtapaCafe) {
    if (e === etapa) return
    setEtapa(e)
    setTecnica(null)
    setV({ entrada: entradaSugerida != null && GUIA_ETAPAS[e].campos.includes('entrada') ? redondear(entradaSugerida) : '' })
    setDestino(null)
    setSca(null)
    setSabores([])
    setAviso(null)
  }

  function validar(): string | null {
    const e = num('entrada')
    const s = num('salida')
    if (e != null && s != null && s > e && etapa !== 'Cosecha') return 'Lo que sale no puede ser más de lo que entra.'
    const h = num('humedad')
    if (h != null && (h < 0 || h > 100)) return 'La humedad debe estar entre 0 y 100 %.'
    const ph = num('ph')
    if (ph != null && (ph < 0 || ph > 14)) return 'El pH debe estar entre 0 y 14.'
    if (destino === 'Compostaje' && !(num('aguaResidual') ?? 0)) return 'Indica cuántos litros de aguas mieles van a compostaje.'
    if (!tipo) return 'Elige el tipo de proceso.'
    return null
  }

  function enviar(ev: FormEvent) {
    ev.preventDefault()
    const problema = validar()
    setAviso(problema)
    if (problema || !tipo) return
    const tiempo = num(pide('dias') ? 'dias' : pide('minutos') ? 'minutos' : 'horas')
    const horas = tiempo == null ? undefined : pide('dias') ? tiempo * 24 : pide('minutos') ? tiempo / 60 : tiempo
    const notas = [sabores.length ? `Notas de sabor: ${sabores.join(', ')}.` : '', nota.trim()].filter(Boolean).join(' ')
    onSubmit({
      stage: etapa,
      // Un día pasado se guarda al mediodía local para que no cambie de fecha al pasar a UTC.
      recordedAt: fecha === hoy() ? new Date().toISOString() : new Date(`${fecha}T12:00:00`).toISOString(),
      inputKg: pide('entrada') ? num('entrada') : undefined,
      outputKg: pide('salida') ? num('salida') : undefined,
      waterLiters: pide('agua') ? num('agua') : undefined,
      wastewaterLiters: pide('aguaResidual') ? num('aguaResidual') : undefined,
      compostReuse: destino === 'Compostaje',
      wastewaterDestination: pide('destinoAgua') ? optionalText(destino === 'Otro' ? destinoOtro : (destino ?? '')) : undefined,
      durationHours: horas,
      method: escribirMetodo(tipo, variante, tecnica),
      brix: pide('brix') ? num('brix') : undefined,
      ph: pide('ph') ? num('ph') : undefined,
      moisturePercent: pide('humedad') ? num('humedad') : undefined,
      scaScore: pide('sca') ? (sca ?? undefined) : undefined,
      notes: optionalText(notas),
    })
  }

  const cantidad = <Cantidad etapa={etapa} pide={pide} v={v} set={set} num={num} entradaSugerida={entradaSugerida} />

  return (
    <form className="cf-form" onSubmit={enviar}>
      <div className="cf-form-cabeza">
        <span className="cf-form-emoji" aria-hidden="true">
          {guia.emoji}
        </span>
        <div>
          <h3>{guia.nombre}</h3>
          <p>{guia.queEs}</p>
        </div>
      </div>

      <div className="cf-etapas-selector" role="group" aria-label="Etapa">
        {ruta.map((e) => (
          <button
            type="button"
            key={e}
            className={`${e === etapa ? 'activa' : ''} ${hechas.has(e) ? 'hecha' : ''}`}
            aria-pressed={e === etapa}
            onClick={() => cambiarEtapa(e)}
          >
            {hechas.has(e) ? '✓ ' : ''}
            {GUIA_ETAPAS[e].emoji} {e}
          </button>
        ))}
      </div>

      <div className="cf-consejo">
        <span aria-hidden="true">💡</span>
        <div>
          <small>Lo recomendado</small>
          <p>{consejoDe(tipo, etapa)}</p>
        </div>
      </div>

      {!tipo && (
        <Bloque titulo="¿Qué tipo de proceso es?" ayuda="Lo usamos para guiarte">
          <div className="cf-chips">
            {TIPOS_PROCESO.map((t) => (
              <button type="button" key={t.id} onClick={() => setTipo(t)}>
                {t.emoji} {t.nombre}
              </button>
            ))}
          </div>
        </Bloque>
      )}

      {guia.tecnicas && (
        <Bloque titulo={etapa === 'Tostión' ? 'Perfil de tueste' : '¿Cómo lo hiciste?'} ayuda="(opcional)">
          <div className="cf-chips">
            {guia.tecnicas.map((t) => (
              <button type="button" key={t} className={tecnica === t ? 'activo' : ''} aria-pressed={tecnica === t} onClick={() => setTecnica(tecnica === t ? null : t)}>
                {t}
              </button>
            ))}
          </div>
        </Bloque>
      )}

      <div className="cf-form-grid">
        {etapa !== 'Secado' && cantidad}
        <Tiempo etapa={etapa} tipo={tipo} pide={pide} v={v} set={set} />
        {(pide('brix') || pide('ph')) && (
          <Bloque titulo="Mediciones" ayuda="(opcional) al inicio o al final">
            <div className="cf-dos">
              {pide('brix') && <Numero etiqueta="°Brix" unidad="°Bx" valor={v.brix ?? ''} onChange={set('brix')} />}
              {pide('ph') && <Numero etiqueta="pH" unidad="pH" valor={v.ph ?? ''} onChange={set('ph')} />}
            </div>
          </Bloque>
        )}
        {pide('agua') && (
          <Bloque titulo="Agua del lavado" ancho>
            <div className="cf-dos">
              <Numero etiqueta="Agua limpia usada" unidad="L" valor={v.agua ?? ''} onChange={set('agua')} />
              <Numero etiqueta="Aguas mieles (con mucílago)" unidad="L" valor={v.aguaResidual ?? ''} onChange={set('aguaResidual')} />
            </div>
            {num('agua') != null && entradaSugerida != null && entradaSugerida > 0 && (
              <Calculado etiqueta="Agua por kilo de café" valor={`${(num('agua')! / entradaSugerida).toFixed(1)} L/kg`} detalle="Entre menos agua uses, menos aguas mieles produces." tono="azul" />
            )}
            <small className="cf-subtitulo">¿A dónde van las aguas mieles?</small>
            <div className="cf-chips azul">
              {DESTINOS_AGUA.map((d) => (
                <button type="button" key={d} className={destino === d ? 'activo' : ''} aria-pressed={destino === d} onClick={() => setDestino(destino === d ? null : d)}>
                  {d}
                </button>
              ))}
            </div>
            {destino === 'Otro' && <input className="cf-input" aria-label="Otro destino" placeholder="¿Cuál?" value={destinoOtro} onChange={(e) => setDestinoOtro(e.target.value)} />}
            {(destino === 'Compostaje' || destino === 'Sistema de tratamiento') && <p className="cf-bien">🌍 ¡Muy bien! Así cuidas el agua de tu vereda.</p>}
          </Bloque>
        )}
        {pide('humedad') && (
          <Bloque titulo="Humedad del grano" ayuda="con medidor">
            <Numero etiqueta="Humedad" unidad="%" valor={v.humedad ?? ''} onChange={set('humedad')} placeholder="Ej: 11" />
            <MedidorHumedad humedad={num('humedad') ?? null} />
          </Bloque>
        )}
        {etapa === 'Secado' && cantidad}
        {pide('sca') && <Catacion sca={sca} setSca={setSca} sabores={sabores} setSabores={setSabores} />}
        <Bloque titulo="¿Cuándo?">
          <input className="cf-input" type="date" aria-label="Fecha" max={hoy()} required value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Bloque>
        <Bloque titulo="Nota" ayuda="(opcional)" ancho>
          <textarea className="cf-input" aria-label="Nota" rows={2} placeholder="Clima, temperatura, quién lo hizo…" value={nota} onChange={(e) => setNota(e.target.value)} />
        </Bloque>
      </div>

      {(aviso || error) && <ErrorNotice message={(aviso ?? error)!} />}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : (textoGuardar?.(etapa) ?? `Guardar ${etapa.toLowerCase()}`)} <Icon name="check" size={16} />
        </Button>
      </div>
    </form>
  )
}

function Bloque({ titulo, ayuda, ancho, children }: { titulo: string; ayuda?: string; ancho?: boolean; children: ReactNode }) {
  return (
    <fieldset className={`cf-bloque${ancho ? ' ancho' : ''}`}>
      <legend>
        {titulo} {ayuda && <small>{ayuda}</small>}
      </legend>
      {children}
    </fieldset>
  )
}

function Numero({ etiqueta, unidad, valor, onChange, placeholder = '0' }: { etiqueta: string; unidad: string; valor: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="cf-numero">
      <span>{etiqueta}</span>
      <div>
        <input inputMode="decimal" aria-label={etiqueta} placeholder={placeholder} value={valor} onChange={(e) => onChange(e.target.value)} />
        <b>{unidad}</b>
      </div>
    </label>
  )
}

function Calculado({ etiqueta, valor, detalle, tono = 'verde' }: { etiqueta: string; valor: string; detalle?: string; tono?: 'verde' | 'azul' | 'naranja' }) {
  return (
    <div className={`cf-calculado ${tono}`} role="status">
      <div>
        <small>{etiqueta}</small>
        {detalle && <span>{detalle}</span>}
      </div>
      <strong>{valor}</strong>
    </div>
  )
}

function Cantidad({
  etapa,
  pide,
  v,
  set,
  num,
  entradaSugerida,
}: {
  etapa: EtapaCafe
  pide: (c: Campo) => boolean
  v: Partial<Record<Campo, string>>
  set: (c: Campo) => (valor: string) => void
  num: (c: Campo) => number | undefined
  entradaSugerida: number | null
}) {
  if (!pide('entrada') && !pide('salida')) return null
  const guia = GUIA_ETAPAS[etapa]
  const e = num('entrada')
  const s = num('salida')
  let calculo: ReactNode = null
  if (e != null && s != null && e > 0 && s <= e) {
    const pct = (s / e) * 100
    if (etapa === 'Trilla') calculo = <Calculado etiqueta="Rendimiento en café verde" valor={`${pct.toFixed(1)} %`} detalle={`De cada 100 kg de pergamino salen ${pct.toFixed(0)} kg de almendra.`} />
    else if (etapa === 'Tostión') {
      const merma = 100 - pct
      calculo = <Calculado etiqueta="Pérdida de peso al tostar" valor={`${merma.toFixed(1)} %`} detalle="Lo normal es entre 12 % y 20 %." tono={merma >= 12 && merma <= 20 ? 'verde' : 'naranja'} />
    } else calculo = <Calculado etiqueta="Rendimiento de la etapa" valor={`${pct.toFixed(1)} %`} detalle={`Sale ${redondear(s)} kg de ${redondear(e)} kg.`} />
  }
  return (
    <Bloque titulo="Cantidades" ayuda={entradaSugerida != null && pide('entrada') ? '(lo que entra viene de la etapa anterior)' : undefined}>
      <div className="cf-dos">
        {pide('entrada') && <Numero etiqueta={guia.entradaLabel ?? 'Entra'} unidad="kg" valor={v.entrada ?? ''} onChange={set('entrada')} />}
        {pide('salida') && <Numero etiqueta={guia.salidaLabel ?? 'Sale'} unidad="kg" valor={v.salida ?? ''} onChange={set('salida')} />}
      </div>
      {calculo}
    </Bloque>
  )
}

function Tiempo({ etapa, tipo, pide, v, set }: { etapa: EtapaCafe; tipo: TipoProceso | null; pide: (c: Campo) => boolean; v: Partial<Record<Campo, string>>; set: (c: Campo) => (valor: string) => void }) {
  const campo: Campo | null = pide('dias') ? 'dias' : pide('minutos') ? 'minutos' : pide('horas') ? 'horas' : null
  if (!campo) return null
  const guia = GUIA_ETAPAS[etapa]
  const [unidad, titulo, sugeridos] =
    campo === 'dias'
      ? ['días', '¿Cuántos días de secado?', guia.diasSugeridos ?? []]
      : campo === 'minutos'
        ? ['min', '¿Cuántos minutos de tueste?', [10, 12, 14, 16]]
        : ['horas', '¿Cuántas horas fermentó?', tipo?.id === 'anaerobico' ? [24, 36, 48, 72] : (guia.horasSugeridas ?? [])]
  return (
    <Bloque titulo={titulo} ayuda="(opcional)">
      <div className="cf-rapidos" role="group" aria-label={titulo}>
        {sugeridos.map((n) => (
          <button type="button" key={n} className={v[campo] === String(n) ? 'activo' : ''} onClick={() => set(campo)(String(n))}>
            {n}
          </button>
        ))}
      </div>
      <Numero etiqueta={titulo} unidad={unidad} valor={v[campo] ?? ''} onChange={set(campo)} />
    </Bloque>
  )
}

export function MedidorHumedad({ humedad }: { humedad: number | null }) {
  const max = 60
  const pos = (n: number) => `${(Math.min(Math.max(n, 0), max) / max) * 100}%`
  const [texto, tono] =
    humedad == null
      ? ['Mide la humedad del grano para saber si ya está listo.', 'gris']
      : humedad < 10
        ? ['Muy seco: el grano puede perder calidad y peso.', 'naranja']
        : humedad <= 12
          ? ['¡Listo! Está en el punto ideal para almacenar y vender.', 'verde']
          : humedad <= 20
            ? ['Casi listo: sigue secando un poco más.', 'ambar']
            : ['Aún húmedo: falta secado.', 'cafe']
  return (
    <div className="cf-medidor">
      <div className="cf-medidor-barra">
        <span className="cf-medidor-ideal" style={{ left: pos(10), width: `calc(${pos(12)} - ${pos(10)})` }} />
        {humedad != null && <i className={tono} style={{ left: pos(humedad) }} />}
      </div>
      <div className="cf-medidor-escala">
        <span>0 %</span>
        <b>ideal 10–12 %</b>
        <span>60 %</span>
      </div>
      <p className={tono}>{texto}</p>
    </div>
  )
}

function Catacion({ sca, setSca, sabores, setSabores }: { sca: number | null; setSca: (n: number) => void; sabores: string[]; setSabores: (s: string[]) => void }) {
  const valor = sca ?? 80
  const [categoria, tono] = valor >= 90 ? ['Excepcional', 'morado'] : valor >= 85 ? ['Excelente', 'verde'] : valor >= 80 ? ['Muy bueno · café de especialidad', 'verde'] : ['Por debajo de especialidad', 'cafe']
  return (
    <>
      <Bloque titulo="Puntaje de taza (escala SCA)">
        <div className="cf-sca">
          <strong className={sca == null ? 'vacio' : tono}>{sca == null ? '—' : valor.toFixed(Number.isInteger(valor) ? 0 : 2)}</strong>
          <span>/ 100</span>
          {sca != null && <em className={tono}>{categoria}</em>}
        </div>
        <input type="range" aria-label="Puntaje SCA" min={60} max={100} step={0.25} value={valor} onChange={(e) => setSca(Number(e.target.value))} />
      </Bloque>
      <Bloque titulo="Notas de sabor" ayuda="(elige las que sientas)">
        <div className="cf-chips">
          {NOTAS_SABOR.map((n) => (
            <button
              type="button"
              key={n}
              className={sabores.includes(n) ? 'activo' : ''}
              aria-pressed={sabores.includes(n)}
              onClick={() => setSabores(sabores.includes(n) ? sabores.filter((x) => x !== n) : [...sabores, n])}
            >
              {n}
            </button>
          ))}
        </div>
      </Bloque>
    </>
  )
}
