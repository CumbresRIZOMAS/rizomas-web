import { useEffect, useState } from 'react'
import { Icon } from '../../shared/ui'
import {
  COLOR_CAPA,
  COLOR_DOP,
  DENOMINACIONES,
  ESCALA_PRODUCCION,
  GRUPOS_CAPAS,
  RIOS,
  formatear,
  type CafeDatos,
  type CapaId,
  type Contexto,
  type Dato,
  type DopId,
  type MunicipioCafe,
  type TextosCapas,
} from './capasMapa'
import { nombreVisible, type Idioma } from './origenesMapa'

export function PanelCapas({ activas, onCambiar, t, onCerrar }: { activas: Set<CapaId>; onCambiar: (capa: CapaId) => void; t: TextosCapas; onCerrar: () => void }) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar])
  return (
    <div className="rz-capas" role="dialog" aria-label={t.capas}>
      {GRUPOS_CAPAS.map(({ grupo, capas }) => (
        <fieldset key={grupo}>
          <legend>{t.grupos[grupo]}</legend>
          {capas.map((capa) => (
            <label key={capa} className={activas.has(capa) ? 'activa' : ''}>
              <input type="checkbox" checked={activas.has(capa)} onChange={() => onCambiar(capa)} />
              <span className="rz-capa-muestra" style={{ background: COLOR_CAPA[capa] }} aria-hidden="true" />
              <span className="rz-capa-texto">
                <b>{t.nombres[capa]}</b>
                <small>{t.ayudas[capa]}</small>
              </span>
              <span className="rz-interruptor" aria-hidden="true" />
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  )
}

export function LeyendaProduccion({ t, idioma }: { t: TextosCapas; idioma: Idioma }) {
  const gradiente = `linear-gradient(90deg, ${ESCALA_PRODUCCION.map(([, c]) => c).join(', ')})`
  return (
    <div className="rz-leyenda-prod">
      <small>{t.leyendaProduccion}</small>
      <span style={{ background: gradiente }} />
      <div>
        {ESCALA_PRODUCCION.map(([v]) => (
          <i key={v}>{v >= 1000 ? `${formatear(v / 1000, idioma)}k` : v}</i>
        ))}
      </div>
    </div>
  )
}

export function DatosCuriosos({
  datos,
  t,
  onVer,
  pie,
}: {
  datos: Dato[]
  t: TextosCapas
  onVer: (dato: Dato) => void
  pie?: React.ReactNode
}) {
  const [i, setI] = useState(0)
  const [pausa, setPausa] = useState(false)
  const actual = datos[i % Math.max(datos.length, 1)]
  useEffect(() => {
    if (pausa || datos.length < 2) return
    const temporizador = window.setTimeout(() => setI((x) => (x + 1) % datos.length), 11000)
    return () => window.clearTimeout(temporizador)
  }, [i, pausa, datos.length])
  if (!actual) return null
  return (
    <aside className="rz-sabias" onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)} onFocus={() => setPausa(true)} onBlur={() => setPausa(false)}>
      <div className="rz-sabias-cabeza">
        <span>{t.sabias}</span>
        <div>
          <button type="button" aria-label="‹" onClick={() => setI((x) => (x - 1 + datos.length) % datos.length)}>
            ‹
          </button>
          <small>
            {(i % datos.length) + 1}/{datos.length}
          </small>
          <button type="button" aria-label="›" onClick={() => setI((x) => (x + 1) % datos.length)}>
            ›
          </button>
        </div>
      </div>
      <p key={actual.id} aria-live="polite">
        {actual.texto}
      </p>
      <div className="rz-sabias-pie">
        <button type="button" onClick={() => onVer(actual)}>
          <Icon name="location" size={13} /> {t.verMapa}
        </button>
        <a href="#fuentes">{actual.fuente}</a>
      </div>
      {pie}
    </aside>
  )
}

function Cabecera({ kicker, titulo, color, onCerrar, t }: { kicker: string; titulo: string; color: string; onCerrar: () => void; t: { cerrar: string } }) {
  return (
    <div className="rz-contexto-cabeza" style={{ background: `linear-gradient(135deg, ${color}, rgba(17,27,19,.95) 85%)` }}>
      <button type="button" onClick={onCerrar} aria-label={t.cerrar}>
        <Icon name="close" size={16} />
      </button>
      <span>{kicker}</span>
      <h3>{titulo}</h3>
    </div>
  )
}

function FichaDop({ id, t, idioma }: { id: DopId; t: TextosCapas; idioma: Idioma }) {
  const d = DENOMINACIONES[id]
  return (
    <>
      <p className="rz-contexto-nota">{d.resolucion[idioma]}</p>
      {d.zona && (
        <div className="rz-bloque">
          <dt>{t.zona}</dt>
          <dd>{d.zona[idioma]}</dd>
        </div>
      )}
      <div className="rz-bloque destacado">
        <dt>{t.perfil}</dt>
        <dd>{d.perfil[idioma]}</dd>
      </div>
      {d.porque && (
        <div className="rz-bloque">
          <dt>{t.porque}</dt>
          <dd>{d.porque[idioma]}</dd>
        </div>
      )}
      {d.dato && (
        <div className="rz-bloque">
          <dt>{t.datoTitulo}</dt>
          <dd>
            {d.dato.texto[idioma]} <small>({d.dato.fuente})</small>
          </dd>
        </div>
      )}
      <p className="rz-contexto-fuente">cafedecolombia.com · SIC</p>
    </>
  )
}

export function TarjetaContexto({
  contexto,
  datosCafe,
  t,
  idioma,
  cerrar,
  onCerrar,
  onContexto,
  onVolar,
}: {
  contexto: Contexto
  datosCafe: CafeDatos | null
  t: TextosCapas
  idioma: Idioma
  cerrar: string
  onCerrar: () => void
  onContexto: (c: Contexto) => void
  onVolar: (lng: number, lat: number) => void
}) {
  const f = (n: number, dec = 0) => formatear(n, idioma, dec)
  const comun = { onCerrar, t: { cerrar } }
  let cuerpo: React.ReactNode
  let cabeza: React.ReactNode
  switch (contexto.tipo) {
    case 'municipio': {
      const m = contexto.datos
      const anio = datosCafe?.produccion.anio ?? 2025
      cabeza = <Cabecera {...comun} kicker={t.municipioKicker} titulo={`${nombreVisible(m.m)}, ${nombreVisible(m.d)}`} color={COLOR_CAPA.produccion} />
      cuerpo = (
        <>
          <p className="rz-contexto-grande">{t.puesto(m.r, datosCafe?.produccion.municipios ?? 0)}</p>
          <dl className="rz-datos">
            <div>
              <dt>{t.produccionAnio(anio)}</dt>
              <dd>{t.toneladas(m.t)}</dd>
            </div>
            <div>
              <dt>{t.sembradas}</dt>
              <dd>{t.hectareas(m.h)}</dd>
            </div>
          </dl>
          <EnlacesContexto m={m} t={t} onContexto={onContexto} />
          <p className="rz-contexto-fuente">UPRA · EVA {anio}</p>
        </>
      )
      break
    }
    case 'dop': {
      cabeza = <Cabecera {...comun} kicker={t.dopKicker} titulo={DENOMINACIONES[contexto.id].nombre} color={COLOR_DOP[contexto.id]} />
      cuerpo = <FichaDop id={contexto.id} t={t} idioma={idioma} />
      break
    }
    case 'pcc':
      cabeza = <Cabecera {...comun} kicker={t.pccKicker} titulo={t.pccTitulo} color={COLOR_CAPA.pcc} />
      cuerpo = (
        <>
          <p>{t.pccTexto}</p>
          <p className="rz-contexto-fuente">UNESCO · whc.unesco.org/es/list/1121</p>
        </>
      )
      break
    case 'paramo':
      cabeza = <Cabecera {...comun} kicker={t.paramoKicker} titulo={contexto.nombre} color={COLOR_CAPA.paramos} />
      cuerpo = (
        <>
          <p>{t.paramoTexto}</p>
          <dl className="rz-datos">
            <div className="ancho">
              <dt>{t.zona}</dt>
              <dd>{t.hectareas(contexto.ha)}</dd>
            </div>
            {contexto.resolucion && (
              <div className="ancho">
                <dt>{t.delimitacion}</dt>
                <dd>{contexto.resolucion}</dd>
              </div>
            )}
          </dl>
          <p className="rz-contexto-fuente">MinAmbiente · Instituto Humboldt</p>
        </>
      )
      break
    case 'protegida':
      cabeza = <Cabecera {...comun} kicker={contexto.categoria} titulo={contexto.nombre} color={COLOR_CAPA.protegidas} />
      cuerpo = (
        <>
          <dl className="rz-datos">
            <div className="ancho">
              <dt>{t.zona}</dt>
              <dd>{t.hectareas(contexto.ha)}</dd>
            </div>
            {contexto.organizacion && (
              <div className="ancho">
                <dt>{t.administra}</dt>
                <dd>{contexto.organizacion}</dd>
              </div>
            )}
          </dl>
          {contexto.url && (
            <a className="rz-enlace" href={contexto.url} target="_blank" rel="noreferrer">
              {t.verRunap} <Icon name="arrow" size={13} />
            </a>
          )}
          <p className="rz-contexto-fuente">RUNAP · Parques Nacionales Naturales</p>
        </>
      )
      break
    case 'puerto': {
      const total = datosCafe?.exportaciones.sacos ?? 0
      const anio = datosCafe?.exportaciones.anio ?? 2025
      cabeza = <Cabecera {...comun} kicker={t.puertoKicker} titulo={contexto.nombre} color={COLOR_CAPA.puertos} />
      cuerpo = (
        <>
          <dl className="rz-datos">
            <div className="ancho destacado">
              <dt>{t.puertoTexto(anio)}</dt>
              <dd>{t.sacos(contexto.sacos)}</dd>
            </div>
          </dl>
          {total > 0 && <p className="rz-contexto-grande">{t.deTotal(f((contexto.sacos / total) * 100, 1))}</p>}
          <p className="rz-contexto-fuente">Federación Nacional de Cafeteros</p>
        </>
      )
      break
    }
    case 'destino': {
      const total = datosCafe?.exportaciones.sacos ?? 0
      const anio = datosCafe?.exportaciones.anio ?? 2025
      cabeza = <Cabecera {...comun} kicker={t.destinoKicker} titulo={idioma === 'es' ? contexto.es : contexto.en} color={COLOR_CAPA.destinos} />
      cuerpo = (
        <>
          <dl className="rz-datos">
            <div className="ancho destacado">
              <dt>{t.destinoTexto(anio)}</dt>
              <dd>{t.sacos(contexto.sacos)}</dd>
            </div>
            <div className="ancho">
              <dt>USD</dt>
              <dd>{t.usd(contexto.usd)}</dd>
            </div>
          </dl>
          {total > 0 && <p className="rz-contexto-grande">{t.deTotal(f((contexto.sacos / total) * 100, 1))}</p>}
          <p className="rz-contexto-fuente">Federación Nacional de Cafeteros</p>
        </>
      )
      break
    }
    case 'exportaciones': {
      const e = datosCafe?.exportaciones
      cabeza = <Cabecera {...comun} kicker={t.expoKicker} titulo={t.expoTitulo(e?.anio ?? 2025)} color={COLOR_CAPA.destinos} />
      if (!e) {
        cuerpo = null
        break
      }
      const max = e.destinos[0]?.sacos ?? 1
      const totalTipos = Object.values(e.tipos).reduce((a, b) => a + b, 0) || 1
      cuerpo = (
        <>
          <p className="rz-contexto-grande">{t.expoResumen(f(e.sacos / 1e6, 1), e.paises, t.usd(e.usd))}</p>
          <div className="rz-bloque">
            <dt>{t.expoTipos}</dt>
            <dd className="rz-tipos">
              {Object.entries(e.tipos).map(([tipo, n]) => (
                <span key={tipo}>
                  <b>{f((n / totalTipos) * 100, 1)} %</b> {t.tipos[tipo] ?? tipo}
                </span>
              ))}
            </dd>
          </div>
          <div className="rz-ranking">
            <small>{t.expoTop}</small>
            <ol>
              {e.destinos.slice(0, 10).map((d) => (
                <li key={d.es}>
                  <button
                    type="button"
                    onClick={() => {
                      onVolar(d.lng, d.lat)
                      onContexto({ tipo: 'destino', es: d.es, en: d.en, sacos: d.sacos, usd: d.usd })
                    }}
                  >
                    <span>{idioma === 'es' ? d.es : d.en}</span>
                    <i style={{ width: `${Math.max(4, (d.sacos / max) * 100)}%` }} />
                    <em>{f((d.sacos / e.sacos) * 100, 1)} %</em>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <p className="rz-contexto-fuente">Federación Nacional de Cafeteros</p>
        </>
      )
      break
    }
    case 'rio':
      cabeza = <Cabecera {...comun} kicker={t.rioKicker} titulo={idioma === 'es' ? `Río ${contexto.nombre}` : `${contexto.nombre} River`} color={COLOR_CAPA.rios} />
      cuerpo = (
        <>
          {RIOS[contexto.nombre] && <p>{RIOS[contexto.nombre][idioma]}</p>}
          <p className="rz-contexto-fuente">Natural Earth</p>
        </>
      )
      break
  }
  return (
    <aside className="rz-ficha rz-contexto" aria-label={t.capas}>
      {cabeza}
      <div className="rz-ficha-cuerpo">{cuerpo}</div>
    </aside>
  )
}

export function EnlacesContexto({ m, t, onContexto }: { m: MunicipioCafe; t: TextosCapas; onContexto: (c: Contexto) => void }) {
  if (!m.dop && !m.pcc) return null
  return (
    <div className="rz-chips-contexto">
      {m.dop && (
        <button type="button" style={{ borderColor: COLOR_DOP[m.dop] }} onClick={() => onContexto({ tipo: 'dop', id: m.dop! })}>
          <i style={{ background: COLOR_DOP[m.dop] }} /> {t.dopKicker}: {DENOMINACIONES[m.dop].nombre}
        </button>
      )}
      {m.pcc && (
        <button type="button" style={{ borderColor: COLOR_CAPA.pcc }} onClick={() => onContexto({ tipo: 'pcc' })}>
          <i style={{ background: COLOR_CAPA.pcc }} /> {t.pccTitulo}
        </button>
      )}
    </div>
  )
}

/** Bloque "En su municipio" dentro de la ficha de una finca. */
export function MunicipioDeFinca({ m, total, anio, t, onContexto }: { m: MunicipioCafe; total: number; anio: number; t: TextosCapas; onContexto: (c: Contexto) => void }) {
  return (
    <div className="rz-municipio-finca">
      <small>{t.enMunicipio}</small>
      <button type="button" className="rz-municipio-boton" onClick={() => onContexto({ tipo: 'municipio', datos: m })}>
        <b>{m.r === 1 ? '🥇 ' : ''}{t.puesto(m.r, total)}</b>
        <span>
          {t.toneladas(m.t)} · {anio}
        </span>
      </button>
      <EnlacesContexto m={m} t={t} onContexto={onContexto} />
    </div>
  )
}
