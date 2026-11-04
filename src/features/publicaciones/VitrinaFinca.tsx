import type { CSSProperties } from 'react'
import type { Decimal, PublicFarmTraceability, PublicProcessEvent, PublicTraceability } from '../../shared/api/types'
import { FARM_TYPE_LABEL, formatLongDate, formatNumber, toNumber } from '../../shared/format'
import { ETAPAS_CAFE, GUIA_ETAPAS, esEtapa, leerMetodo, type EtapaCafe } from '../cafe/guiaBeneficio'
import './vitrina.css'

/** Acepta la trazabilidad por publicación o por finca (los conteos son opcionales). */
type Traza = Pick<PublicTraceability, 'origin' | 'processes'> &
  Partial<Pick<PublicTraceability, 'crop' | 'harvest'>> &
  Partial<Pick<PublicFarmTraceability, 'lotsCount' | 'harvestsCount'>>
type Proceso = Traza['processes'][number]

/** Escala SCA: 80+ es café de especialidad. */
function categoriaSca(puntaje: number): {
  nombre: string
  frase: string
  tono: 'excepcional' | 'excelente' | 'muybueno' | 'base'
} {
  if (puntaje >= 90)
    return {
      nombre: 'Excepcional',
      frase: 'Entre los mejores cafés del mundo',
      tono: 'excepcional',
    }
  if (puntaje >= 85)
    return {
      nombre: 'Excelente',
      frase: 'Café de especialidad de alta gama',
      tono: 'excelente',
    }
  if (puntaje >= 80)
    return {
      nombre: 'Muy bueno',
      frase: 'Café de especialidad',
      tono: 'muybueno',
    }
  return {
    nombre: 'Calidad comercial',
    frase: 'Por debajo del umbral de especialidad (80)',
    tono: 'base',
  }
}

const SABORES: Record<string, { emoji: string; color: string }> = {
  Chocolate: { emoji: '🍫', color: '#6b4226' },
  Panela: { emoji: '🍯', color: '#b7791f' },
  Caramelo: { emoji: '🍮', color: '#c0812d' },
  Frutal: { emoji: '🍓', color: '#c2414b' },
  Floral: { emoji: '🌸', color: '#b5508c' },
  Cítrico: { emoji: '🍋', color: '#a8a018' },
  Nuez: { emoji: '🌰', color: '#8a5a3b' },
  Especiado: { emoji: '🌶️', color: '#b4441e' },
}

const num = (v: Decimal | null | undefined) => toNumber(v)

function eventos(p: Proceso): PublicProcessEvent[] {
  return [...(p.events ?? [])].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
}

/** El proceso más avanzado con catación, o el más reciente. */
function procesoDestacado(procesos: Proceso[]): Proceso | null {
  const conCata = procesos.filter((p) => eventos(p).some((e) => num(e.scaScore) !== null))
  const lista = conCata.length ? conCata : procesos
  return lista.length ? lista.reduce((a, b) => (b.startedAt > a.startedAt ? b : a)) : null
}

function tipoDe(evs: PublicProcessEvent[]) {
  for (const e of [...evs].reverse()) {
    const m = leerMetodo(e.method)
    if (m.tipo) return m
  }
  return null
}

function datosEtapa(e: PublicProcessEvent | undefined): string[] {
  if (!e) return []
  const entrada = num(e.inputKg)
  const salida = num(e.outputKg)
  const horas = num(e.durationHours)
  const humedad = num(e.moisturePercent)
  const brix = num(e.brix)
  const ph = num(e.ph)
  return [
    entrada !== null && salida !== null
      ? `${formatNumber(entrada)} → ${formatNumber(salida)} kg`
      : salida !== null
        ? `${formatNumber(salida)} kg`
        : entrada !== null
          ? `${formatNumber(entrada)} kg`
          : '',
    horas !== null ? (horas >= 48 ? `${formatNumber(Math.round(horas / 24))} días` : `${formatNumber(horas)} h`) : '',
    humedad !== null ? `${formatNumber(humedad)} % humedad` : '',
    brix !== null ? `${formatNumber(brix)} °Brix` : '',
    ph !== null ? `pH ${formatNumber(ph)}` : '',
  ].filter(Boolean)
}

/** Medidor circular del puntaje (escala visible de 60 a 100). */
function Medidor({ puntaje }: { puntaje: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  const avance = Math.min(1, Math.max(0, (puntaje - 60) / 40))
  return (
    <svg className="vt-medidor" viewBox="0 0 128 128" aria-hidden="true">
      <circle cx="64" cy="64" r={r} className="vt-medidor-fondo" />
      <circle cx="64" cy="64" r={r} className="vt-medidor-arco" strokeDasharray={`${c * avance} ${c}`} transform="rotate(-90 64 64)" />
    </svg>
  )
}

export function VitrinaFinca({ traza, nombre }: { traza: Traza; nombre: string }) {
  const proceso = procesoDestacado(traza.processes)
  const evs = proceso ? eventos(proceso) : []
  const cata = [...evs].reverse().find((e) => num(e.scaScore) !== null)
  const puntaje = cata ? num(cata.scaScore) : null
  const sabores = [...new Set(evs.flatMap((e) => e.flavorNotes ?? []))]
  const tipo = tipoDe(evs)
  const humedadFinal =
    [...evs]
      .reverse()
      .map((e) => num(e.moisturePercent))
      .find((h) => h !== null) ?? null

  const porEtapa = new Map<string, PublicProcessEvent>()
  for (const e of evs) porEtapa.set(e.stage, e)
  const base = tipo?.tipo?.etapas ?? ETAPAS_CAFE.slice(0, 6)
  const ruta: EtapaCafe[] = ETAPAS_CAFE.filter((e) => base.includes(e) || porEtapa.has(e) || (puntaje !== null && e === 'Catación'))
  const extra = evs.map((e) => e.stage).filter((s, i, a) => !esEtapa(s) && a.indexOf(s) === i)

  const lotes = traza.lotsCount ?? null
  const cosechas = traza.harvestsCount ?? null
  const cifras = [
    lotes !== null && {
      valor: formatNumber(lotes),
      etiqueta: lotes === 1 ? 'lote de café' : 'lotes de café',
    },
    traza.crop && {
      valor: traza.crop.variety ?? (traza.crop.species.replace(/^café\s*/i, '') || 'Café'),
      etiqueta: traza.crop.variety ? 'variedad' : 'especie',
    },
    traza.harvest && {
      valor: `${formatNumber(traza.harvest.quantity)} ${traza.harvest.unit}`,
      etiqueta: 'última cosecha',
    },
    cosechas !== null &&
      cosechas > 0 && {
        valor: formatNumber(cosechas),
        etiqueta: cosechas === 1 ? 'cosecha registrada' : 'cosechas registradas',
      },
    traza.origin.farmType && {
      valor: FARM_TYPE_LABEL[traza.origin.farmType],
      etiqueta: 'tipo de finca',
    },
  ].filter(Boolean) as { valor: string; etiqueta: string }[]

  const categoria = puntaje !== null ? categoriaSca(puntaje) : null

  return (
    <div className="vitrina">
      {categoria && puntaje !== null && (
        <section className={`vt-taza vt-${categoria.tono}`} aria-label={`Puntaje de taza ${formatNumber(puntaje)} puntos SCA, ${categoria.nombre}`}>
          <div className="vt-taza-puntaje">
            <Medidor puntaje={puntaje} />
            <div>
              <strong>{formatNumber(puntaje)}</strong>
              <small>puntos SCA</small>
            </div>
          </div>
          <div className="vt-taza-texto">
            <span className="vt-sello">{puntaje >= 80 ? '☕ Café de especialidad' : '☕ Catación registrada'}</span>
            <h2>{categoria.nombre}</h2>
            <p>
              {categoria.frase}. El café de {nombre} fue catado {cata ? `el ${formatLongDate(cata.recordedAt)}` : ''} siguiendo el protocolo de la SCA (Specialty Coffee
              Association).
            </p>
            {sabores.length > 0 && (
              <div className="vt-sabores">
                <small>En taza</small>
                <ul>
                  {sabores.map((s) => (
                    <li
                      key={s}
                      style={
                        {
                          '--sabor': SABORES[s]?.color ?? '#7a4f32',
                        } as CSSProperties
                      }
                    >
                      <span aria-hidden="true">{SABORES[s]?.emoji ?? '☕'}</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <ol className="vt-escala" aria-hidden="true">
            {[
              ['80', 'Muy bueno'],
              ['85', 'Excelente'],
              ['90', 'Excepcional'],
            ].map(([n, t]) => (
              <li key={n} className={puntaje >= Number(n) ? 'si' : ''}>
                <b>{n}+</b> {t}
              </li>
            ))}
          </ol>
        </section>
      )}

      {cifras.length > 0 && (
        <dl className="vt-cifras">
          {cifras.map((c) => (
            <div key={c.etiqueta}>
              <dd>{c.valor}</dd>
              <dt>{c.etiqueta}</dt>
            </div>
          ))}
        </dl>
      )}

      {proceso && (
        <section className="vt-proceso">
          <header>
            <span className="vt-kicker">Del árbol a la taza</span>
            <h2>{tipo?.tipo ? `Proceso ${tipo.tipo.nombre}${tipo.variante ? ` ${tipo.variante.toLowerCase()}` : ''}` : 'Así se procesó este café'}</h2>
            {tipo?.tipo && (
              <p>
                <span aria-hidden="true">{tipo.tipo.emoji}</span> {tipo.tipo.resumen} <b>{tipo.tipo.taza}.</b>
                {tipo.tecnica && <> Técnica: {tipo.tecnica}.</>}
              </p>
            )}
            {humedadFinal !== null && humedadFinal >= 10 && humedadFinal <= 12 && <p className="vt-ok">✓ Secado al punto ideal: {formatNumber(humedadFinal)} % de humedad</p>}
          </header>
          <ol className="vt-ruta">
            {[...ruta, ...extra].map((etapa, i) => {
              const e = porEtapa.get(etapa)
              const guia = esEtapa(etapa) ? GUIA_ETAPAS[etapa] : null
              const datos = etapa === 'Catación' && puntaje !== null ? [`${formatNumber(puntaje)} pts SCA`] : datosEtapa(e)
              return (
                <li key={etapa} className={e ? 'hecha' : 'pendiente'} style={{ '--i': i } as CSSProperties}>
                  <span className="vt-ruta-icono" aria-hidden="true">
                    {guia?.emoji ?? '☕'}
                  </span>
                  <strong>{etapa}</strong>
                  {e ? <time dateTime={e.recordedAt}>{formatLongDate(e.recordedAt)}</time> : <time>Pendiente</time>}
                  {guia && <p>{guia.queEs}</p>}
                  {datos.length > 0 && (
                    <ul>
                      {datos.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ol>
          {proceso.finishedAt ? (
            <p className="vt-estado listo">Proceso terminado el {formatLongDate(proceso.finishedAt)}</p>
          ) : (
            <p className="vt-estado">Proceso en curso desde el {formatLongDate(proceso.startedAt)}</p>
          )}
        </section>
      )}
    </div>
  )
}
