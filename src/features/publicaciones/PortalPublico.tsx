import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../shared/api/client'
import type { Publication, PublicTraceability } from '../../shared/api/types'
import { useAuth } from '../../shared/auth/context'
import { env } from '../../shared/config/env'
import { FARM_TYPE_LABEL, formatLongDate, formatNumber, toNumber } from '../../shared/format'
import { Button, Chip, Icon, type IconName } from '../../shared/ui'

// Fotos de paisaje del diseño (decorativas, no son de una finca concreta).
const FOTO_PAISAJE = 'https://images.unsplash.com/photo-1568489711036-9c94a7d5aea6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=85&w=1600'
const FOTO_CEREZAS = 'https://images.unsplash.com/photo-1672851612794-6687bf0bf1a3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=85&w=600'
const FOTO_FINCA = 'https://images.unsplash.com/photo-1532443603613-61fa154742cd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=700'
const FOTO_PROMO = 'https://images.unsplash.com/photo-1532185922611-3410b1898a1c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=900'
const FOTO_ORIGEN = 'https://images.unsplash.com/photo-1672015151052-d6fa87fc8aba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=85&w=1500'

const TODAS = 'Todas las regiones'

const PASOS = [
  { emoji: '👩‍🌾', titulo: 'La finca registra', texto: 'Labores, cosechas y fotos desde la app, incluso sin señal en el lote.' },
  { emoji: '🧪', titulo: 'El técnico acompaña', texto: 'Analiza el suelo y recomienda prácticas y bioinsumos para regenerarlo.' },
  { emoji: '☕', titulo: 'Cosecha y beneficio', texto: 'Cada etapa, del despulpado al tostado, queda documentada y verificada.' },
  { emoji: '🔍', titulo: 'Tú conoces su historia', texto: 'Ves el origen y las prácticas, sin coordenadas exactas ni datos privados.' },
]

/**
 * Fotos aprobadas de la publicación. El bucket es privado: el backend redirige
 * cada una a una URL firmada de corta duración.
 */
function fotosDe(p: Publication): string[] {
  return p.evidences.map((e) => `${env.apiUrl}/api/v1/publications/${p.id}/photos/${e.evidence.id}`)
}
const ANIO = new Date().getFullYear()

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

/**
 * Portal público (RF-18). Solo consume el endpoint público de publicaciones:
 * región, cantidad producida y fotos aprobadas. Nunca coordenadas exactas,
 * datos personales ni comerciales (ASR-15), por eso el mapa ubica orígenes por
 * región y no por punto.
 */
export function PortalPublico() {
  const { token } = useAuth()
  const [publicaciones, setPublicaciones] = useState<Publication[] | null>(null)
  const [fallo, setFallo] = useState(false)
  const [region, setRegion] = useState(TODAS)
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [listaAbierta, setListaAbierta] = useState(true)
  const [detalle, setDetalle] = useState(false)

  useEffect(() => {
    let vigente = true
    api<Publication[]>('/publications')
      .then((data) => vigente && setPublicaciones(data))
      .catch(() => vigente && setFallo(true))
    return () => {
      vigente = false
    }
  }, [])

  const lista = publicaciones ?? []
  const regiones = [...new Set(lista.map((p) => p.region).filter((r): r is string => Boolean(r)))].sort()
  const filtradas = lista.filter((p) => region === TODAS || p.region === region)
  const activa = filtradas.find((p) => p.id === seleccion) ?? filtradas[0] ?? null
  const contacto = env.contactEmail
  // Kilos de café documentados en las publicaciones (solo las que están en kg).
  const kilos = lista.filter((p) => (p.unit ?? 'kg') === 'kg').reduce((s, p) => s + (toNumber(p.quantity) ?? 0), 0)
  const destacada = lista[0] ?? null

  return (
    <div className="public-site">
      <header className="public-header">
        <button type="button" className="public-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span>
            <Icon name="leaf" size={24} />
          </span>
          <div>
            <strong>RIZOMAS</strong>
            <small>CAFÉ CON ORIGEN</small>
          </div>
        </button>
        <nav>
          <button type="button" className="active" onClick={() => scrollTo('explorar')}>
            Explorar orígenes
          </button>
          <button type="button" onClick={() => scrollTo('vincular')}>
            Vincular mi finca
          </button>
          <button type="button" onClick={() => scrollTo('sobre')}>
            Sobre Rizomas
          </button>
        </nav>
        <div className="public-actions">
          <Link className="btn btn-secondary" to={token ? '/inicio' : '/ingresar'}>
            <Icon name="users" size={17} />
            {token ? 'Ir al panel' : 'Ingresar'}
          </Link>
        </div>
      </header>

      <section className="public-intro">
        <div className="hero-copy">
          <span className="public-kicker">
            <Icon name="location" size={14} /> Territorios cafeteros de Colombia
          </span>
          <h1>
            Cada taza guarda
            <br />
            un <em>territorio.</em>
          </h1>
          <p>
            Recorre las montañas donde nace el café colombiano. Conoce sus regiones, sus procesos y la historia verificable detrás de cada cosecha, sin
            exponer los datos privados de quienes lo cultivan.
          </p>
          <div className="hero-actions">
            <Button onClick={() => scrollTo('explorar')}>
              Explorar orígenes <Icon name="arrow" size={16} />
            </Button>
            <button type="button" onClick={() => scrollTo('vincular')}>
              <span>
                <Icon name="coffee" size={17} />
              </span>
              Vincular mi finca
            </button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-photo-main">
            <img src={FOTO_PAISAJE} alt="Montañas verdes de una región cafetera colombiana" />
            <span className="hero-place">
              <Icon name="location" size={17} />
              <span>
                <small>Explorando</small>
                <strong>Territorios cafeteros de Colombia</strong>
              </span>
            </span>
          </div>
          <div className="hero-photo-coffee">
            <img src={FOTO_CEREZAS} alt="Cerezas maduras de café en la planta" />
          </div>
          <div className="hero-verified">
            <span>
              <Icon name="check" size={17} />
            </span>
            <div>
              <strong>Origen verificado</strong>
              <small>Información desde la finca</small>
            </div>
          </div>
          <span className="hero-chip chip-1">🌱 Prácticas documentadas</span>
          <span className="hero-chip chip-2">☕ Del cafetal a tu taza</span>
          <svg className="hero-route" viewBox="0 0 180 90" aria-hidden="true">
            <path d="M5 80C50 5 105 100 175 12" />
            <circle cx="5" cy="80" r="4" />
            <circle cx="175" cy="12" r="4" />
          </svg>
        </div>
        <div className="public-stats">
          <span className="stat-emoji">
            <i aria-hidden="true">☕</i>
            <span>
              <strong>{publicaciones ? lista.length : '—'}</strong>
              <small>Orígenes publicados</small>
            </span>
          </span>
          <span className="stat-emoji">
            <i aria-hidden="true">🗺️</i>
            <span>
              <strong>{publicaciones ? regiones.length : '—'}</strong>
              <small>Regiones cafeteras</small>
            </span>
          </span>
          <span className="stat-emoji">
            <i aria-hidden="true">⚖️</i>
            <span>
              <strong>{publicaciones ? formatNumber(kilos) : '—'}</strong>
              <small>Kilos de café documentados</small>
            </span>
          </span>
          <span className="trace-stat">
            <Icon name="trace" size={20} />
            <small>
              Trazabilidad
              <br />
              <b>abierta y confiable</b>
            </small>
          </span>
        </div>
      </section>

      <section className="como-funciona" aria-labelledby="como-funciona-titulo">
        <span className="public-kicker">Cómo funciona</span>
        <h2 id="como-funciona-titulo">Así llega la historia de tu café 🌄</h2>
        <div className="pasos">
          {PASOS.map((paso, i) => (
            <article key={paso.titulo}>
              <span className="paso-emoji" aria-hidden="true">
                {paso.emoji}
              </span>
              <small>Paso {i + 1}</small>
              <strong>{paso.titulo}</strong>
              <p>{paso.texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="map-explorer" id="explorar">
        <div className="map-toolbar">
          <div className="map-toolbar-title">
            <span>
              <Icon name="location" />
            </span>
            <div>
              <strong>Mapa de orígenes</strong>
              <small>Explora las regiones con café publicado</small>
            </div>
          </div>
          <div className="map-filters">
            <label>
              <span>Región</span>
              <select value={region} onChange={(e) => setRegion(e.target.value)}>
                <option>{TODAS}</option>
                {regiones.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="map-body">
          <div className="map-canvas">
            <img src={FOTO_PAISAJE} alt="Paisaje montañoso de una región cafetera colombiana" />
            <div className="map-shade" />
            <svg className="contour-lines" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
              <path d="M-80 440C110 300 202 515 390 352s302-76 470-226 278 30 278 30" />
              <path d="M-85 486C98 344 220 558 413 399s309-76 475-223 268 21 268 21" />
              <path d="M-92 530C107 388 236 604 430 446s323-72 481-214 260 6 260 6" />
              <path d="M90 90c145 45 170-66 302-20s189 19 280-39" />
            </svg>
            {regiones.slice(0, 5).map((r, i) => (
              <button
                type="button"
                key={r}
                className={`region-label region-slot-${i + 1}`}
                style={{ pointerEvents: 'auto', background: 'none', border: 0, cursor: 'pointer', opacity: region === TODAS || region === r ? 1 : 0.4 }}
                onClick={() => setRegion(region === r ? TODAS : r)}
              >
                {r.toUpperCase()}
                <span>
                  {lista.filter((p) => p.region === r).length} {lista.filter((p) => p.region === r).length === 1 ? 'origen' : 'orígenes'}
                </span>
              </button>
            ))}
            <div className="map-compass">
              N<span>◆</span>
            </div>
          </div>
          <aside className={`farm-drawer ${listaAbierta ? '' : 'closed'}`}>
            <div className="drawer-head">
              <div>
                <span>{filtradas.length} resultados</span>
                <strong>Orígenes en el territorio</strong>
              </div>
              <button type="button" onClick={() => setListaAbierta(!listaAbierta)} aria-label={listaAbierta ? 'Cerrar lista' : 'Abrir lista'}>
                <Icon name={listaAbierta ? 'close' : 'menu'} />
              </button>
            </div>
            {listaAbierta && (
              <>
                {!publicaciones && !fallo && <p className="loading">Cargando orígenes…</p>}
                {fallo && <p className="loading">No se pudieron cargar los orígenes. Intenta más tarde.</p>}
                {publicaciones && filtradas.length === 0 && <p className="loading">Todavía no hay orígenes publicados{region !== TODAS ? ' en esta región' : ''}.</p>}
                <div className="drawer-list">
                  {filtradas.map((p) => (
                    <button
                      type="button"
                      className={activa?.id === p.id ? 'selected' : ''}
                      key={p.id}
                      onClick={() => {
                        setSeleccion(p.id)
                        setDetalle(true)
                      }}
                    >
                      <div className="farm-thumb">
                        <Icon name="leaf" />
                      </div>
                      <div>
                        <span>Origen verificado</span>
                        <strong>{p.title}</strong>
                        <small>
                          <Icon name="location" size={12} />
                          {p.region ?? 'Colombia'}
                        </small>
                        {p.quantity !== null && (
                          <em>
                            {formatNumber(p.quantity)} {p.unit ?? ''} producidos
                          </em>
                        )}
                      </div>
                      <Icon name="arrow" size={17} />
                    </button>
                  ))}
                </div>
                {activa && (
                  <div className="active-farm-card">
                    <div className="active-farm-photo">
                      <img src={fotosDe(activa)[0] ?? FOTO_FINCA} alt={`Origen ${activa.title}`} />
                      <Chip tone="green">Verificado</Chip>
                    </div>
                    <div>
                      <span>ORIGEN DESTACADO</span>
                      <h2>{activa.title}</h2>
                      <p>{activa.region ?? 'Colombia'}</p>
                      <div className="farm-flavors">
                        <span>
                          <small>Producción</small>
                          <strong>{activa.quantity !== null ? `${formatNumber(activa.quantity)} ${activa.unit ?? ''}` : '—'}</strong>
                        </span>
                        <span>
                          <small>Publicado</small>
                          <strong>{formatLongDate(activa.publishedAt)}</strong>
                        </span>
                      </div>
                      <Button onClick={() => setDetalle(true)}>
                        Conocer este origen <Icon name="arrow" size={16} />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      </section>

      <section className="territorio-taza">
        <div>
          <span className="public-kicker">Trazabilidad abierta</span>
          <h2>
            Del territorio a tu taza,
            <br />
            sin perder la historia.
          </h2>
          <p>
            Cada finca comparte su región, sus prácticas, variedades y procesos. Así puedes conocer a las personas y el paisaje detrás de cada café, sin
            exponer sus datos privados.
          </p>
          <div className="territorio-checks">
            <span>
              <Icon name="check" size={14} /> Origen verificado
            </span>
            <span>
              <Icon name="check" size={14} /> Prácticas documentadas
            </span>
            <span>
              <Icon name="check" size={14} /> Información para compradores
            </span>
          </div>
          <Button variant="secondary" onClick={() => scrollTo('explorar')}>
            Ver los orígenes publicados
          </Button>
        </div>
        <div className="territorio-foto">
          <img src={FOTO_ORIGEN} alt="Paisaje cafetero colombiano con palmas de cera" />
          {destacada && (
            <button type="button" className="territorio-producto" onClick={() => { setSeleccion(destacada.id); setDetalle(true) }}>
              <Icon name="coffee" size={24} />
              <span>
                <small>Producto trazado</small>
                <strong>
                  {destacada.title}
                  {destacada.region ? ` · ${destacada.region}` : ''}
                </strong>
              </span>
              <em>Verificado</em>
            </button>
          )}
        </div>
      </section>

      <section className="origin-section join-promo" id="vincular">
        <div className="origin-copy">
          <span className="public-kicker">Haz parte de Rizomas</span>
          <h2>
            Tu finca también puede
            <br />
            estar en este mapa.
          </h2>
          <p>
            Conecta tu finca con compradores, técnicos y amantes del café que valoran el origen. En RIZOMAS te ayudamos a documentar tus prácticas,
            demostrar la calidad de tu producto y contar la historia de tu territorio.
          </p>
          <div className="origin-features">
            <span>
              <Icon name="check" />
              Más visibilidad para tu café
            </span>
            <span>
              <Icon name="check" />
              Trazabilidad fácil y confiable
            </span>
            <span>
              <Icon name="check" />
              Nuevas oportunidades comerciales
            </span>
          </div>
          {contacto && (
            <div className="join-actions">
              <a className="btn btn-primary" href={`mailto:${contacto}?subject=${encodeURIComponent('Quiero vincular mi finca a RIZOMAS')}`}>
                Quiero vincular mi finca <Icon name="arrow" size={16} />
              </a>
            </div>
          )}
        </div>
        <div className="origin-image promo-image">
          <img src={FOTO_PROMO} alt="Cultivo verde en paisaje cafetero de montaña" />
          <div>
            <Icon name="farm" />
            <span>
              <small>Comunidad Rizomas</small>
              <strong>{publicaciones ? `${lista.length} ${lista.length === 1 ? 'origen ya está' : 'orígenes ya están'} mostrando su historia` : 'Fincas mostrando su origen'}</strong>
            </span>
            <Chip tone="green">Únete</Chip>
          </div>
        </div>
      </section>

      {detalle && activa && <DetalleOrigen publicacion={activa} contacto={contacto} onClose={() => setDetalle(false)} />}

      <footer className="public-footer" id="sobre">
        <div className="public-brand">
          <span>
            <Icon name="leaf" />
          </span>
          <div>
            <strong>RIZOMAS</strong>
            <small>Cumbres Sacras SAS · Colombia</small>
          </div>
        </div>
        <p>Conectamos el territorio, las personas y el café a través de información confiable.</p>
        <span>© {ANIO} RIZOMAS</span>
      </footer>
    </div>
  )
}

type Paso = [string, string, string, IconName]

function pasosBasicos(p: Publication): Paso[] {
  return [
    ['Origen', p.region ?? 'Colombia', 'Ubicación regional, sin coordenadas exactas', 'farm'],
    ['Cosecha', p.quantity !== null ? `${formatNumber(p.quantity)} ${p.unit ?? ''}` : 'Cantidad no publicada', 'Registrada en la finca', 'coffee'],
    ['Producto', p.title, `Publicado el ${formatLongDate(p.publishedAt)}`, 'report'],
  ]
}

/** Pasos del read model público (región, cultivo, prácticas, cosecha, beneficio, producto). */
function pasosPublicos(t: PublicTraceability): Paso[] {
  const practicas = Object.values(t.practices.laborsByType).reduce((s, n) => s + (n ?? 0), 0)
  const ultimo = t.processes.at(-1)
  const producto = t.processes.flatMap((p) => p.products).at(-1)
  const certificaciones = t.processes.flatMap((p) => p.products.flatMap((x) => x.certifications))
  const pasos: Paso[] = [
    ['Origen', t.origin.region ?? 'Colombia', t.origin.farmType ? `Finca ${FARM_TYPE_LABEL[t.origin.farmType].toLowerCase()}` : 'Ubicación regional', 'farm'],
  ]
  if (t.crop) pasos.push(['Cultivo', [t.crop.species, t.crop.variety].filter(Boolean).join(' '), 'Variedad sembrada en el lote', 'leaf'])
  pasos.push([
    'Prácticas',
    `${practicas} labores documentadas`,
    [t.practices.soilAnalyses && `${t.practices.soilAnalyses} análisis de suelo`, t.practices.bioinputApplications && `${t.practices.bioinputApplications} aplicaciones de bioinsumos`]
      .filter(Boolean)
      .join(' · ') || 'Manejo registrado en RIZOMAS',
    'tool',
  ])
  if (t.harvest) pasos.push(['Cosecha', `${formatNumber(t.harvest.quantity)} ${t.harvest.unit}`, [formatLongDate(t.harvest.date), t.harvest.quality].filter(Boolean).join(' · '), 'coffee'])
  if (ultimo) pasos.push(['Beneficio', ultimo.finishedAt ? 'Proceso finalizado' : ultimo.stage, `Desde el ${formatLongDate(ultimo.startedAt)}`, 'drop'])
  pasos.push([
    'Producto',
    producto?.destination ?? t.publication.title,
    certificaciones.length ? certificaciones.map((c) => c.certifier).join(' · ') : `Publicado el ${formatLongDate(t.publication.publishedAt)}`,
    'report',
  ])
  return pasos
}

function DetalleOrigen({ publicacion: p, contacto, onClose }: { publicacion: Publication; contacto: string; onClose: () => void }) {
  const fotos = fotosDe(p)
  const [traza, setTraza] = useState<PublicTraceability | null>(null)

  useEffect(() => {
    let vigente = true
    api<PublicTraceability>(`/publications/${p.id}/traceability`)
      .then((t) => vigente && setTraza(t))
      .catch(() => vigente && setTraza(null))
    return () => {
      vigente = false
    }
  }, [p.id])

  const pasos = traza ? pasosPublicos(traza) : pasosBasicos(p)

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
            <Chip tone="green">
              <Icon name="check" size={13} /> Origen verificado
            </Chip>
            <span>CAFÉ DE ORIGEN · {(p.region ?? 'Colombia').toUpperCase()}</span>
            <h1>{p.title}</h1>
            <p>{p.quantity !== null ? `${formatNumber(p.quantity)} ${p.unit ?? ''} producidos` : 'Producción documentada en RIZOMAS'}</p>
          </div>
        </header>
        <div className="origin-detail-body">
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
                <h2>Trazabilidad de {p.title}</h2>
                <p>Cada paso fue documentado en RIZOMAS</p>
              </div>
              <Chip tone="green">
                <Icon name="check" size={13} /> Información verificada
              </Chip>
            </div>
            <div className="public-trace-line" style={{ gridTemplateColumns: `repeat(${pasos.length},1fr)` }}>
              {pasos.map(([paso, titulo, texto, icon], i) => (
                <div key={paso}>
                  <span>{i + 1}</span>
                  <i>
                    <Icon name={icon} />
                  </i>
                  <small>{paso}</small>
                  <strong>{titulo}</strong>
                  <p>{texto}</p>
                </div>
              ))}
            </div>
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
          {contacto && (
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
        </div>
      </article>
    </div>
  )
}
