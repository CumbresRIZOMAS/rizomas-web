import { useEffect, useId, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { ApiError, api } from '../../shared/api/client'
import { useApiQuery } from '../../shared/api/hooks'
import type { Publication, PublicFarmTraceability, PublicTraceability } from '../../shared/api/types'
import { useAuth } from '../../shared/auth/context'
import { env } from '../../shared/config/env'
import { FARM_TYPE_LABEL, LABOR_TYPE_LABEL, formatLongDate, formatNumber, toNumber } from '../../shared/format'
import { Button, Chip, Icon, type IconName } from '../../shared/ui'
import { Bibliografia } from './Bibliografia'
import { OriginExplorer } from './OriginExplorer'
import { TiposDeCafe } from './TiposDeCafe'
import { nombreVisible } from './origenesMapa'
import './portal.css'

// Fotos de paisaje del diseño (decorativas, no son de una finca concreta).
const FOTO_PROMO = 'https://images.unsplash.com/photo-1532185922611-3410b1898a1c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1600'
const FOTO_ORIGEN = 'https://images.unsplash.com/photo-1672015151052-d6fa87fc8aba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=85&w=1500'

/** Logo: grano de café que brota, sobre un fondo verde degradado. */
function MarcaRizomas() {
  const id = useId()
  return (
    <svg className="pp-brand-mark" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3f7d3b" />
          <stop offset="1" stopColor="#173a22" />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbf4e2" />
          <stop offset="1" stopColor="#e8d6b0" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill={`url(#${id}f)`} />
      <rect x=".5" y=".5" width="39" height="39" rx="11.5" fill="none" stroke="#fff" strokeOpacity=".14" />
      <path d="M21.6 15.6c.6-1 1.2-1.8 1.9-2.4" fill="none" stroke="#a9cc74" strokeWidth="1.3" strokeLinecap="round" />
      <g transform="rotate(-28 18 24)">
        <ellipse cx="18" cy="24" rx="7.6" ry="10" fill={`url(#${id}g)`} />
        <path d="M18 14.4c-3 3.2 3 6.4 0 9.6s3 6.4 0 9.6" fill="none" stroke="#2c5f2d" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <path d="M23.5 13.2c.4-4 3.2-6.6 8-7 .2 4.6-2.6 7.4-8 7z" fill="#a9cc74" />
      <path d="M23.5 13.2c1.6-2 3.4-3.6 5.6-4.8" fill="none" stroke="#2c5f2d" strokeWidth=".9" strokeLinecap="round" />
    </svg>
  )
}

function normalizarRegion(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleUpperCase('es')
}

const PASOS: { icon: IconName; quien: string; color: string; titulo: string; texto: string }[] = [
  { icon: 'farm', quien: 'En la finca', color: '#a9cc74', titulo: 'La finca registra', texto: 'Labores, cosechas y fotos desde la app, incluso sin señal en el lote.' },
  { icon: 'soil', quien: 'Con el técnico', color: '#7fc4b8', titulo: 'El técnico acompaña', texto: 'Analiza el suelo y recomienda prácticas y bioinsumos para regenerarlo.' },
  { icon: 'coffee', quien: 'En el beneficio', color: '#e2b65c', titulo: 'Cosecha y beneficio', texto: 'Cada etapa, del despulpado al tostado, queda documentada y verificada.' },
  { icon: 'trace', quien: 'En tu taza', color: '#e59a6c', titulo: 'Tú conoces su historia', texto: 'Ves el origen y las prácticas, sin coordenadas exactas ni datos privados.' },
]

/**
 * Fotos aprobadas de la publicación. El bucket es privado: el backend redirige
 * cada una a una URL firmada de corta duración.
 */
function fotosDe(p: Publication): string[] {
  return [
    ...(p.farmProfile?.images ?? []).map((image) => image.url),
    ...p.evidences.map((e) => `${env.apiUrl}/api/v1/publications/${p.id}/photos/${e.evidence.id}`),
  ]
}

function enlaceWeb(value: string | null | undefined): string | null {
  const candidate = value?.trim()
  return candidate && /^https?:\/\//i.test(candidate) ? candidate : null
}

function urlMapaPublico(location: Publication['publicLocation']): string | null {
  const latitude = Number(location?.latitude)
  const longitude = Number(location?.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  const pad = 0.035
  const bbox = `${longitude - pad},${latitude - pad},${longitude + pad},${latitude + pad}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`
}
const ANIO = new Date().getFullYear()

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

/**
 * Portal público (RF-18). Solo consume el endpoint público de publicaciones:
 * región, cantidad producida y fotos aprobadas. Nunca coordenadas exactas,
 * datos personales ni comerciales (ASR-15). El mapa usa únicamente la
 * ubicación pública/aproximada que la finca autorizó compartir.
 */
export function PortalPublico() {
  const { token } = useAuth()
  const publicacionesQuery = useApiQuery<Publication[]>('/publications')
  const origenesQuery = useApiQuery<Publication[]>('/publications/origins')
  const publicaciones = publicacionesQuery.data
  const origenes = origenesQuery.data ?? publicaciones
  const fallo = !publicaciones && !origenesQuery.data
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [detalle, setDetalle] = useState(false)

  const lista = publicaciones ?? []
  const listaOrigenes = origenes ?? []
  const regiones = [...new Map(listaOrigenes.flatMap((p) => p.region ? [[normalizarRegion(p.region), p.region] as const] : [])).values()].sort()
  const activa = listaOrigenes.find((p) => p.id === seleccion) ?? null
  const contacto = env.contactEmail
  // Kilos de café documentados en las publicaciones (solo las que están en kg).
  const kilos = lista.filter((p) => (p.unit ?? 'kg') === 'kg').reduce((s, p) => s + (toNumber(p.quantity) ?? 0), 0)
  const destacada = listaOrigenes.find((origin) => origin.isPublished !== false) ?? null

  return (
    <div className="public-site">
      <header className="pp-header">
        <button type="button" className="pp-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <MarcaRizomas />
          <span className="pp-brand-text">
            <strong>RIZOMAS</strong>
            <small>Café con origen</small>
          </span>
        </button>
        <nav aria-label="Secciones">
          <button type="button" onClick={() => scrollTo('explorar')}>Mapa</button>
          <button type="button" onClick={() => scrollTo('como-funciona')}>Cómo funciona</button>
          <button type="button" onClick={() => scrollTo('tipos-de-cafe')}>Tipos de café</button>
          <button type="button" onClick={() => scrollTo('vincular')}>Para fincas</button>
          <button type="button" onClick={() => scrollTo('fuentes')}>Fuentes</button>
        </nav>
        <Link className="pp-login" to={token ? '/inicio' : '/ingresar'}>
          <Icon name="users" size={16} />
          {token ? 'Ir al panel' : 'Ingresar'}
        </Link>
      </header>

      <section className="pp-intro">
        <div className="pp-intro-copy">
          <span className="pp-kicker">
            <span className="pp-dot" aria-hidden="true" /> Territorios cafeteros de Colombia
          </span>
          <h1>
            Cada taza guarda un <em>territorio</em>.
          </h1>
        </div>
        <div className="pp-intro-side">
          <p>
            Explora en el mapa las fincas donde nace el café colombiano: sus regiones, sus procesos y la historia verificable detrás de cada cosecha, sin
            exponer datos privados.
          </p>
          <dl className="pp-stats">
            <div>
              <dt>Fincas en el mapa</dt>
              <dd>{origenes ? listaOrigenes.length : '—'}</dd>
            </div>
            <div>
              <dt>Regiones</dt>
              <dd>{publicaciones ? regiones.length : '—'}</dd>
            </div>
            <div>
              <dt>Kg documentados</dt>
              <dd>{publicaciones ? formatNumber(kilos) : '—'}</dd>
            </div>
          </dl>
        </div>
      </section>

      <OriginExplorer
        origenes={origenes ?? undefined}
        fallo={fallo}
        onAbrir={(origen) => {
          setSeleccion(origen.id)
          setDetalle(true)
        }}
      />

      <section className="pp-como" id="como-funciona" aria-labelledby="como-funciona-titulo">
        <div className="pp-como-head">
          <span className="pp-kicker">Cómo funciona</span>
          <h2 id="como-funciona-titulo">
            Así llega la historia <em>de tu café</em>
          </h2>
          <p>Del lote a la taza, cada paso queda registrado por quien lo vive.</p>
        </div>
        <ol className="pp-ruta">
          {PASOS.map((paso, i) => (
            <li key={paso.titulo} style={{ '--c': paso.color } as CSSProperties}>
              <div className="pp-ruta-marca" aria-hidden="true">
                <span className="pp-ruta-icono">
                  <Icon name={paso.icon} size={28} />
                </span>
                <b>{i + 1}</b>
              </div>
              <span className="pp-ruta-quien">{paso.quien}</span>
              <strong>{paso.titulo}</strong>
              <p>{paso.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <TiposDeCafe />

      <section className="pp-section pp-territorio">
        <div className="pp-territorio-foto">
          <img src={FOTO_ORIGEN} alt="Paisaje cafetero colombiano con palmas de cera" loading="lazy" />
          {destacada && (
            <button type="button" className="pp-destacada" onClick={() => { setSeleccion(destacada.id); setDetalle(true) }}>
              <span className="pp-destacada-icon">
                <Icon name="coffee" size={20} />
              </span>
              <span>
                <small>Producto trazado</small>
                <strong>
                  {nombreVisible(destacada.title)}
                  {destacada.region ? ` · ${nombreVisible(destacada.region)}` : ''}
                </strong>
              </span>
              <Icon name="arrow" size={16} />
            </button>
          )}
        </div>
        <div className="pp-territorio-copy">
          <span className="pp-kicker">Trazabilidad abierta</span>
          <h2>Del territorio a tu taza, sin perder la historia.</h2>
          <p>
            Cada finca comparte su región, sus prácticas, variedades y procesos. Así puedes conocer a las personas y el paisaje detrás de cada café, sin
            exponer sus datos privados.
          </p>
          <ul className="pp-checks">
            <li><Icon name="check" size={14} /> Origen verificado</li>
            <li><Icon name="check" size={14} /> Prácticas documentadas</li>
            <li><Icon name="check" size={14} /> Información para compradores</li>
          </ul>
          <button type="button" className="pp-link" onClick={() => scrollTo('explorar')}>
            Volver al mapa <Icon name="arrow" size={16} />
          </button>
        </div>
      </section>

      <section className="pp-vincular" id="vincular">
        <img src={FOTO_PROMO} alt="" aria-hidden="true" loading="lazy" />
        <div className="pp-vincular-copy">
          <span className="pp-kicker">Haz parte de Rizomas</span>
          <h2>Tu finca también puede estar en este mapa.</h2>
          <p>
            Conecta tu finca con compradores, técnicos y amantes del café que valoran el origen. Te ayudamos a documentar tus prácticas, demostrar la
            calidad de tu producto y contar la historia de tu territorio.
          </p>
          <ul className="pp-checks">
            <li><Icon name="check" size={14} /> Más visibilidad para tu café</li>
            <li><Icon name="check" size={14} /> Trazabilidad fácil y confiable</li>
            <li><Icon name="check" size={14} /> Nuevas oportunidades comerciales</li>
          </ul>
          {contacto && (
            <a className="pp-cta" href={`mailto:${contacto}?subject=${encodeURIComponent('Quiero vincular mi finca a RIZOMAS')}`}>
              Quiero vincular mi finca <Icon name="arrow" size={16} />
            </a>
          )}
        </div>
        {listaOrigenes.length > 0 && (
          <div className="pp-vincular-dato">
            <strong>{listaOrigenes.length}</strong>
            <span>{listaOrigenes.length === 1 ? 'finca ya muestra su origen' : 'fincas ya muestran su origen'}</span>
          </div>
        )}
      </section>

      {detalle && activa && <DetalleOrigen publicacion={activa} contacto={contacto} onClose={() => setDetalle(false)} />}

      <Bibliografia />

      <footer className="pp-footer" id="sobre">
        <div className="pp-brand">
          <MarcaRizomas />
          <span className="pp-brand-text">
            <strong>RIZOMAS</strong>
            <small>Cumbres Sacras SAS · Colombia</small>
          </span>
        </div>
        <p>Conectamos el territorio, las personas y el café a través de información confiable.</p>
        <span>© {ANIO} RIZOMAS</span>
      </footer>
    </div>
  )
}

type Paso = { etapa: string; detalle: string; fecha: string; icon: IconName; hecha: boolean }
type TrazabilidadOrigen = Pick<PublicTraceability, 'origin' | 'processes'> &
  Partial<Pick<PublicTraceability, 'crop' | 'harvest' | 'practices' | 'publication'>> &
  Partial<Pick<PublicFarmTraceability, 'lotsCount' | 'cropsCount' | 'harvestsCount'>>

/** Timeline público alineado con la secuencia Finca → Producto final de la app móvil. */
function pasosPublicos(t: TrazabilidadOrigen, p: Publication): Paso[] {
  const practices = t.practices ?? { laborsByType: {}, soilAnalyses: 0, bioinputApplications: 0, recommendations: 0 }
  const labores = Object.entries(practices.laborsByType).filter(([tipo]) => tipo !== 'COSECHA')
  const totalLabores = labores.reduce((s, [, n]) => s + (n ?? 0), 0)
  const detalleLabores = labores
    .filter(([, cantidad]) => cantidad > 0)
    .map(([tipo, cantidad]) => `${LABOR_TYPE_LABEL[tipo as keyof typeof LABOR_TYPE_LABEL] ?? tipo}: ${cantidad}`)
    .join(' · ')
  const productos = t.processes.flatMap((p) => p.products)
  const certificaciones = productos.flatMap((x) => x.certifications)
  const pasos: Paso[] = [
    {
      etapa: 'Finca',
      detalle: [p.farmName ?? p.title, p.municipality, t.origin.region ?? 'Colombia', t.origin.farmType && `Finca ${FARM_TYPE_LABEL[t.origin.farmType as keyof typeof FARM_TYPE_LABEL]?.toLowerCase() ?? ''}`].filter(Boolean).join(' · '),
      fecha: 'En curso',
      icon: 'farm',
      hecha: true,
    },
    {
      etapa: 'Lotes',
      detalle: t.lotsCount ? `${t.lotsCount} ${t.lotsCount === 1 ? 'lote registrado' : 'lotes registrados'}` : t.crop || t.harvest ? 'Lote asociado a los datos registrados' : 'Sin lotes registrados todavía',
      fecha: (t.lotsCount ?? 0) > 0 || Boolean(t.crop || t.harvest) ? 'Registrado' : 'Pendiente',
      icon: 'location',
      hecha: (t.lotsCount ?? 0) > 0 || Boolean(t.crop || t.harvest),
    },
    {
      etapa: 'Cultivo',
      detalle: t.crop ? [t.crop.species, t.crop.variety].filter(Boolean).join(' · ') : t.cropsCount ? `${t.cropsCount} cultivos registrados` : 'Sin cultivos registrados todavía',
      fecha: t.crop || (t.cropsCount ?? 0) > 0 ? 'Registrado' : 'Pendiente',
      icon: 'leaf',
      hecha: Boolean(t.crop) || (t.cropsCount ?? 0) > 0,
    },
    {
      etapa: 'Labores',
      detalle: detalleLabores || 'Sin labores documentadas todavía',
      fecha: totalLabores ? `${totalLabores} ${totalLabores === 1 ? 'labor' : 'labores'}` : 'Pendiente',
      icon: 'tool',
      hecha: totalLabores > 0,
    },
    {
      etapa: 'Análisis de suelo',
      detalle: practices.soilAnalyses ? `${practices.soilAnalyses} ${practices.soilAnalyses === 1 ? 'análisis registrado' : 'análisis registrados'}` : 'Sin análisis todavía',
      fecha: practices.soilAnalyses ? 'Registrado' : 'Pendiente',
      icon: 'leaf',
      hecha: practices.soilAnalyses > 0,
    },
    {
      etapa: 'Recomendaciones',
      detalle: practices.recommendations ? `${practices.recommendations} ${practices.recommendations === 1 ? 'recomendación registrada' : 'recomendaciones registradas'}` : 'Sin recomendaciones registradas',
      fecha: practices.recommendations ? 'Registrado' : 'Pendiente',
      icon: 'report',
      hecha: practices.recommendations > 0,
    },
    {
      etapa: 'Aplicación de bioinsumos',
      detalle: practices.bioinputApplications ? `${practices.bioinputApplications} ${practices.bioinputApplications === 1 ? 'aplicación registrada' : 'aplicaciones registradas'}` : 'Sin aplicaciones registradas todavía',
      fecha: practices.bioinputApplications ? 'Registrado' : 'Pendiente',
      icon: 'drop',
      hecha: practices.bioinputApplications > 0,
    },
    {
      etapa: 'Cosecha',
      detalle: t.harvest ? `${formatNumber(t.harvest.quantity)} ${t.harvest.unit}${t.harvest.quality ? ` · ${t.harvest.quality}` : ''}${(t.harvestsCount ?? 0) > 1 ? ` · ${t.harvestsCount} cosechas en total` : ''}` : 'Sin cosechas registradas todavía',
      fecha: t.harvest ? formatLongDate(t.harvest.date) : 'Pendiente',
      icon: 'coffee',
      hecha: Boolean(t.harvest),
    },
  ]
  if (t.processes.length) {
    t.processes.forEach((process) => {
      const events = process.events ?? []
      events.forEach((event) => pasos.push({
        etapa: event.stage,
        detalle: [
          event.inputKg !== null && `Entrada ${formatNumber(event.inputKg)} kg`,
          event.outputKg !== null && `Salida ${formatNumber(event.outputKg)} kg`,
        ].filter(Boolean).join(' · ') || 'Etapa registrada en la finca',
        fecha: formatLongDate(event.recordedAt),
        icon: 'drop',
        hecha: true,
      }))
      pasos.push({
        etapa: process.finishedAt ? 'Proceso finalizado' : 'Proceso en curso',
        detalle: `Etapa actual: ${process.stage}`,
        fecha: process.finishedAt ? formatLongDate(process.finishedAt) : `Inició ${formatLongDate(process.startedAt)}`,
        icon: 'drop',
        hecha: Boolean(process.finishedAt),
      })
    })
  } else {
    pasos.push({ etapa: 'Procesamiento', detalle: 'Sin procesos de beneficio registrados todavía', fecha: 'Pendiente', icon: 'drop', hecha: false })
  }
  const producto = productos.at(-1)
  pasos.push({
    etapa: 'Producto final',
    detalle: producto
      ? [producto.destination ?? t.publication?.title ?? p.title, certificaciones.length && `Certificaciones: ${certificaciones.map((c) => c.certifier).join(', ')}`].filter(Boolean).join(' · ')
      : 'Sin producto final todavía',
    fecha: producto?.finalizedAt ? formatLongDate(producto.finalizedAt) : producto ? 'Registrado' : 'Pendiente',
    icon: 'report',
    hecha: Boolean(producto),
  })
  return pasos
}

function DetalleOrigen({ publicacion: p, contacto, onClose }: { publicacion: Publication; contacto: string; onClose: () => void }) {
  const fotos = fotosDe(p)
  const [traza, setTraza] = useState<TrazabilidadOrigen | null>(null)
  const [estadoTraza, setEstadoTraza] = useState<'loading' | 'loaded' | 'unavailable'>('loading')
  const [errorTraza, setErrorTraza] = useState<string | null>(null)
  const [intentoTraza, setIntentoTraza] = useState(0)

  useEffect(() => {
    let vigente = true
    setTraza(null)
    setErrorTraza(null)
    setEstadoTraza('loading')
    const ruta = p.isPublished === false
      ? `/publications/farms/${p.id.replace(/^farm:/, '')}/traceability`
      : `/publications/${p.id}/traceability`
    api<PublicTraceability | PublicFarmTraceability>(ruta)
      .then((t) => {
        if (!vigente) return
        setTraza(t)
        setEstadoTraza('loaded')
      })
      .catch((error: unknown) => {
        if (!vigente) return
        setTraza(null)
        setErrorTraza(error instanceof ApiError
          ? `${error.status ? `HTTP ${error.status}: ` : ''}${error.message}`
          : error instanceof Error ? error.message : 'Error desconocido')
        setEstadoTraza('unavailable')
      })
    return () => {
      vigente = false
    }
  }, [p.id, p.isPublished, intentoTraza])

  const pasos = traza ? pasosPublicos(traza, p) : []

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="origin-detail-backdrop" onMouseDown={onClose}>
      <article className="origin-detail" role="dialog" aria-modal="true" aria-label={p.title} onMouseDown={(e) => e.stopPropagation()}>
        <header className="origin-detail-hero">
          <img src={fotos[0] ?? FOTO_ORIGEN} alt={`Paisaje cafetero de ${p.region ?? 'Colombia'}`} />
          <div className="origin-hero-shade" />
          <button type="button" onClick={onClose} aria-label="Cerrar origen">
            <Icon name="close" />
          </button>
          <div>
            <Chip tone={p.isPublished === false ? 'gray' : 'green'}>
              {p.isPublished === false ? 'Ubicación registrada' : <><Icon name="check" size={13} /> Origen verificado</>}
            </Chip>
            <span>{p.isPublished === false ? 'FINCA REGISTRADA' : 'CAFÉ DE ORIGEN'} · {(nombreVisible(p.region) || 'Colombia').toUpperCase()}</span>
            <h1>{nombreVisible(p.title)}</h1>
            <p>{p.isPublished === false ? 'Finca con origen y etapas registradas en RIZOMAS' : p.quantity !== null ? `${formatNumber(p.quantity)} ${p.unit ?? ''} producidos` : 'Producción documentada en RIZOMAS'}</p>
          </div>
        </header>
        <div className="origin-detail-body">
          {p.description && <section className="origin-impact"><div><Icon name="leaf" size={26} /><span><small>Historia del origen</small><strong>{p.description}</strong></span></div></section>}
          {p.farmProfile?.description && <section className="farm-profile-story"><span>PERFIL DE LA FINCA</span><p>{p.farmProfile.description}</p></section>}
          {(p.municipality || p.region || urlMapaPublico(p.publicLocation)) && <section className="public-map-detail"><h2>Ubicación compartida</h2><p>{[p.municipality, p.region].filter(Boolean).map(nombreVisible).join(', ') || 'Ubicación aproximada de la finca'}</p>{urlMapaPublico(p.publicLocation) && <><iframe title={`Mapa aproximado de ${p.title}`} src={urlMapaPublico(p.publicLocation)!} loading="lazy" /><a href={`https://www.openstreetmap.org/?mlat=${p.publicLocation!.latitude}&mlon=${p.publicLocation!.longitude}#map=11/${p.publicLocation!.latitude}/${p.publicLocation!.longitude}`} target="_blank" rel="noreferrer">Abrir mapa</a></>}</section>}
          {fotos.length > 0 && (
            <section className="process-gallery">
              <div className="origin-section-title">
                <span>01</span>
                <div>
                  <h2>Así se transforma este café</h2>
                  <p>Imágenes registradas en la finca y aprobadas para publicación</p>
                </div>
              </div>
              <div className="process-photos">
                {fotos.slice(0, 4).map((url, i) => (
                  <figure className={i === 0 ? 'featured' : ''} key={url}>
                    <img src={url} alt={`Evidencia ${i + 1} de ${p.title}`} />
                  </figure>
                ))}
              </div>
            </section>
          )}
          <section className="public-trace">
            <div className="origin-section-title">
              <span>{fotos.length > 0 ? '02' : '01'}</span>
              <div>
                <h2>Trazabilidad de {nombreVisible(p.title)}</h2>
                <p>Se muestran las etapas registradas hasta ahora; los procesos en curso también son visibles.</p>
              </div>
              {estadoTraza === 'loaded' && p.isPublished !== false && <Chip tone="green"><Icon name="check" size={13} /> Información verificada</Chip>}
            </div>
            {estadoTraza === 'loading' && <p className="trace-feedback" role="status">Cargando la trazabilidad y los procesos…</p>}
            {estadoTraza === 'unavailable' && <div className="trace-feedback" role="alert"><p>No se pudo cargar la trazabilidad de esta finca.</p>{errorTraza && <small>Detalle: {errorTraza}</small>}<Button variant="secondary" onClick={() => setIntentoTraza((intento) => intento + 1)}>Intentar de nuevo</Button></div>}
            {estadoTraza === 'loaded' && traza && <>
              {traza.processes.length === 0 && <p className="trace-feedback">Aún no hay procesos de beneficio; los pasos pendientes se muestran en gris.</p>}
              <div className="public-trace-timeline">
                {pasos.map((paso, i) => (
                  <article className={`public-trace-step ${paso.hecha ? 'done' : 'pending'}`} key={`${paso.etapa}-${i}`}>
                    <span className="public-trace-step-icon"><Icon name={paso.icon} /></span>
                    <div className="public-trace-step-card">
                      <div className="public-trace-step-heading">
                        <strong>{paso.etapa}</strong>
                        <span>{paso.fecha}</span>
                      </div>
                      <p>{paso.detalle}</p>
                    </div>
                  </article>
                ))}
              </div>
            </>}
          </section>
          <section className="origin-impact">
            <div>
              <Icon name="leaf" size={26} />
              <span>
                <small>Prácticas documentadas</small>
                <strong>Labores y análisis registrados desde la finca</strong>
              </span>
            </div>
            <div>
              <Icon name="location" size={26} />
              <span>
                <small>Origen transparente</small>
                <strong>Información regional, datos privados protegidos</strong>
              </span>
            </div>
            <div>
              <Icon name="check" size={26} />
              <span>
                <small>Fotos moderadas</small>
                <strong>Solo se publican evidencias aprobadas</strong>
              </span>
            </div>
          </section>
          {contacto && p.isPublished !== false && (
            <section className="farm-contact-cta">
              <div>
                <span>
                  <Icon name="coffee" size={28} />
                </span>
                <div>
                  <small>Contacto protegido por RIZOMAS</small>
                  <h2>¿Te interesa este café?</h2>
                  <p>Escríbenos y te ponemos en contacto con el productor.</p>
                </div>
              </div>
              <a className="btn btn-primary" href={`mailto:${contacto}?subject=${encodeURIComponent(`Interés en ${p.title}`)}`}>
                Contactar <Icon name="arrow" size={16} />
              </a>
            </section>
          )}
          {p.farmProfile && (p.farmProfile.contactEmail || p.farmProfile.contactPhone || p.farmProfile.whatsapp || p.farmProfile.website || p.farmProfile.instagram || p.farmProfile.facebook) && <section className="farm-public-contact">
            <h2>Contacto de la finca</h2>
            <div>
              {p.farmProfile.contactEmail && <a href={`mailto:${p.farmProfile.contactEmail}`}>Correo · {p.farmProfile.contactEmail}</a>}
              {p.farmProfile.contactPhone && <a href={`tel:${p.farmProfile.contactPhone.replace(/[^+\d]/g, '')}`}>Celular · {p.farmProfile.contactPhone}</a>}
              {p.farmProfile.whatsapp && <a href={`https://wa.me/${p.farmProfile.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}
              {enlaceWeb(p.farmProfile.website) && <a href={enlaceWeb(p.farmProfile.website)!} target="_blank" rel="noreferrer">Sitio web</a>}
              {enlaceWeb(p.farmProfile.instagram) && <a href={enlaceWeb(p.farmProfile.instagram)!} target="_blank" rel="noreferrer">Instagram</a>}
              {enlaceWeb(p.farmProfile.facebook) && <a href={enlaceWeb(p.farmProfile.facebook)!} target="_blank" rel="noreferrer">Facebook</a>}
            </div>
          </section>}
        </div>
      </article>
    </div>
  )
}
