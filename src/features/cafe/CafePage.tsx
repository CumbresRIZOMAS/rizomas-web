import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { CoffeeProcess, CoffeeProcessEvent, Farm, Labor, Lot, ProductFinal } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { RequireFarm } from '../../shared/farm/RequireFarm'
import { formatDate, formatNumber, formatShortDate, optionalText } from '../../shared/format'
import { Button, Card, CardTitle, Chip, EmptyState, ErrorNotice, Icon, Loading, PageHeader, SelectField, TextAreaField, TextField } from '../../shared/ui'
import './cafe.css'
import { EtapaForm, type EventoPayload } from './EtapaForm'
import { codigoProceso } from './etapas'
import {
  ETAPAS_CAFE,
  EXPLICACION_VARIANTES,
  GUIA_ETAPAS,
  TIPOS_PROCESO,
  avanceDe,
  consejoDe,
  esEtapa,
  etapasHechas,
  leerMetodo,
  rutaDe,
  siguienteEtapa,
  tipoDeProceso,
  ultimaSalida,
  type EtapaCafe,
  type TipoProceso,
} from './guiaBeneficio'

export function CafePage() {
  return <RequireFarm>{(farm) => <Procesos key={farm.id} farm={farm} />}</RequireFarm>
}

function tituloProceso(p: CoffeeProcess) {
  const { tipo, variante } = tipoDeProceso(p)
  return tipo ? [tipo.nombre, variante?.toLowerCase()].filter(Boolean).join(' ') : 'Proceso sin tipo'
}

function Procesos({ farm }: { farm: Farm }) {
  const { role } = useAuth()
  const puedeRegistrar = canDo(role, ROLES.registrarEnFinca)
  const procesos = useApiQuery<CoffeeProcess[]>(`/coffee-processes/farms/${farm.id}`)
  const labores = useApiQuery<Labor[]>(`/farms/${farm.id}/labors`)
  const lotes = useApiQuery<Lot[]>(`/farms/${farm.id}/lots`)
  // Desde "Registrar labor" se llega con ?proceso=<id>&etapa=<etapa> para seguir un proceso.
  const [params] = useSearchParams()
  const [seleccion, setSeleccion] = useState<string | null>(params.get('proceso'))
  const etapaPedida = params.get('etapa')
  const [creando, setCreando] = useState(false)
  const [guia, setGuia] = useState<TipoProceso | null>(null)
  const lista = procesos.data ?? []
  const activos = lista.filter((p) => !p.finishedAt)
  const terminados = lista.filter((p) => p.finishedAt)
  const actual = lista.find((p) => p.id === seleccion) ?? activos[0] ?? lista[0] ?? null
  const cosechas = (labores.data ?? []).filter((l) => l.type === 'COSECHA' && l.harvest?.id)
  const laborDeCosecha = (harvestId: string | null) => cosechas.find((l) => l.harvest?.id === harvestId)

  return (
    <div className="cf-pagina">
      <PageHeader
        eyebrow={`Finca ${farm.name}`}
        title="Proceso de café"
        subtitle="De la cereza al grano: registra cada etapa y sigue las recomendaciones de cada tipo de proceso."
        actions={
          puedeRegistrar &&
          !creando && (
            <Button icon="plus" onClick={() => setCreando(true)}>
              Iniciar proceso
            </Button>
          )
        }
      />
      {creando && (
        <NuevoProceso
          farmId={farm.id}
          cosechas={cosechas}
          lotes={lotes.data ?? []}
          onVerGuia={setGuia}
          onCancel={() => setCreando(false)}
          onSaved={(id) => {
            setCreando(false)
            setSeleccion(id)
            procesos.reload()
          }}
        />
      )}
      {procesos.loading && !procesos.data && <Loading />}
      {procesos.error && <ErrorNotice message={procesos.error} onRetry={procesos.reload} />}
      {procesos.data && lista.length === 0 && !creando && (
        <EmptyState
          icon="process"
          title="Aún no hay procesos de café"
          action={puedeRegistrar && <Button icon="plus" onClick={() => setCreando(true)}>Iniciar el primero</Button>}
        >
          Cuando coseches, inicia un proceso: te iremos diciendo qué etapa sigue y qué conviene medir.
        </EmptyState>
      )}

      {lista.length > 0 && (
        <section className="cf-procesos" aria-label="Procesos">
          {activos.length > 0 && <h2 className="cf-seccion">En curso · {activos.length}</h2>}
          <div className="cf-tarjetas">
            {activos.map((p) => (
              <TarjetaProceso key={p.id} proceso={p} activa={p.id === actual?.id} onClick={() => setSeleccion(p.id)} />
            ))}
          </div>
          {terminados.length > 0 && (
            <>
              <h2 className="cf-seccion">Terminados · {terminados.length}</h2>
              <div className="cf-tarjetas compactas">
                {terminados.map((p) => (
                  <TarjetaProceso key={p.id} proceso={p} activa={p.id === actual?.id} onClick={() => setSeleccion(p.id)} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {actual && (
        <Detalle
          key={actual.id}
          proceso={actual}
          origen={laborDeCosecha(actual.harvestId)}
          etapaInicial={actual.id === params.get('proceso') && etapaPedida && esEtapa(etapaPedida) ? etapaPedida : null}
          onChanged={procesos.reload}
        />
      )}

      <section className="cf-guia" aria-label="Guía de procesos">
        <h2 className="cf-seccion">Guía de procesos</h2>
        <p>Cada proceso da un sabor distinto. Abre uno para ver sus pasos y lo que recomendamos en cada etapa.</p>
        <div className="cf-guia-tipos">
          {TIPOS_PROCESO.map((t) => (
            <button type="button" key={t.id} onClick={() => setGuia(t)}>
              <span className="cf-guia-emoji">{t.emoji}</span>
              <strong>{t.nombre}</strong>
              <small>{t.taza}</small>
              <em>{t.etapas.map((e) => GUIA_ETAPAS[e].emoji).join(' ')}</em>
              <i>{t.nivel}</i>
            </button>
          ))}
        </div>
      </section>

      {guia && <GuiaModal tipo={guia} onClose={() => setGuia(null)} />}
    </div>
  )
}

function Ruta({ ruta, hechas, siguiente, eventos = [] }: { ruta: EtapaCafe[]; hechas: Set<string>; siguiente: EtapaCafe | null; eventos?: CoffeeProcessEvent[] }) {
  return (
    <ol className="cf-ruta">
      {ruta.map((e) => {
        const estado = hechas.has(e) ? 'hecha' : e === siguiente ? 'siguiente' : ''
        const evento = [...eventos].reverse().find((x) => x.stage === e)
        return (
          <li key={e} className={estado}>
            <span className="cf-ruta-punto" aria-hidden="true">
              {GUIA_ETAPAS[e].emoji}
            </span>
            <strong>{e}</strong>
            <small>{estado === 'hecha' ? (evento ? datoClave(evento) : 'Hecha') : estado === 'siguiente' ? 'Siguiente' : 'Pendiente'}</small>
          </li>
        )
      })}
    </ol>
  )
}

/** Dato más representativo de una etapa para mostrarlo bajo su ícono. */
function datoClave(e: CoffeeProcessEvent): string {
  if (e.moisturePercent != null) return `${formatNumber(e.moisturePercent)} % hum.`
  if (e.scaScore != null) return `SCA ${formatNumber(e.scaScore)}`
  if (e.outputKg != null) return `${formatNumber(e.outputKg)} kg`
  if (e.durationHours != null) return `${formatNumber(e.durationHours)} h`
  if (e.waterLiters != null) return `${formatNumber(e.waterLiters)} L`
  return formatShortDate(e.recordedAt)
}

function TarjetaProceso({ proceso, activa, onClick }: { proceso: CoffeeProcess; activa: boolean; onClick: () => void }) {
  const { tipo } = tipoDeProceso(proceso)
  const siguiente = siguienteEtapa(proceso)
  return (
    <button type="button" className={`cf-tarjeta${activa ? ' activa' : ''}`} aria-pressed={activa} onClick={onClick}>
      <div className="cf-tarjeta-cabeza">
        <span className="cf-tarjeta-emoji">{tipo?.emoji ?? '☕'}</span>
        <span>
          <strong>{tituloProceso(proceso)}</strong>
          <small>
            {proceso.lot?.name ?? 'Sin lote'} · {codigoProceso(proceso)} · desde {formatShortDate(proceso.startedAt)}
          </small>
        </span>
        <em className={proceso.finishedAt ? 'listo' : ''}>{proceso.finishedAt ? 'Terminado' : `${Math.round(avanceDe(proceso) * 100)} %`}</em>
      </div>
      <Ruta ruta={rutaDe(proceso)} hechas={etapasHechas(proceso)} siguiente={siguiente} />
      {siguiente && (
        <span className="cf-tarjeta-siguiente">
          Siguiente: {GUIA_ETAPAS[siguiente].emoji} {siguiente} <Icon name="arrow" size={14} />
        </span>
      )}
    </button>
  )
}

function Detalle({ proceso, origen, etapaInicial, onChanged }: { proceso: CoffeeProcess; origen?: Labor; etapaInicial: EtapaCafe | null; onChanged: () => void }) {
  const { role } = useAuth()
  const puedeEditar = canDo(role, ROLES.registrarEnFinca)
  const puedeCertificar = canDo(role, ROLES.certificar)
  const { mutate, saving, error } = useApiMutation()
  const evento = useApiMutation()
  const [editandoNotas, setEditandoNotas] = useState(false)
  const [notas, setNotas] = useState(proceso.notes ?? '')
  const [agregandoProducto, setAgregandoProducto] = useState(false)
  const [registrando, setRegistrando] = useState<EtapaCafe | null>(etapaInicial)
  const { tipo, variante } = tipoDeProceso(proceso)
  const ruta = rutaDe(proceso)
  const hechas = etapasHechas(proceso)
  const siguiente = siguienteEtapa(proceso)
  const orden = (e: CoffeeProcessEvent) => (esEtapa(e.stage) ? ETAPAS_CAFE.indexOf(e.stage) : -1)
  const eventos = [...(proceso.events ?? [])].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || orden(b) - orden(a))
  const etapaActual = esEtapa(proceso.currentStage) ? proceso.currentStage : null

  async function actualizar(cambio: { currentStage?: string; finishedAt?: string | null; notes?: string }) {
    if (await mutate(`/coffee-processes/${proceso.id}`, 'PATCH', cambio)) {
      setEditandoNotas(false)
      onChanged()
    }
  }

  async function guardarEtapa(payload: EventoPayload) {
    if (await evento.mutate(`/coffee-processes/${proceso.id}/events`, 'POST', payload)) {
      setRegistrando(null)
      onChanged()
    }
  }

  return (
    <section className="cf-detalle" aria-label={`Proceso ${codigoProceso(proceso)}`}>
      <div className="cf-hero">
        <div className="cf-hero-titulo">
          <span>{tipo?.emoji ?? '☕'}</span>
          <div>
            <small>Proceso {codigoProceso(proceso)}</small>
            <h2>{tituloProceso(proceso)}</h2>
            <p>{[proceso.lot?.name ?? origen?.lot?.name, tipo?.taza].filter(Boolean).join(' · ') || 'Sin lote asociado'}</p>
          </div>
        </div>
        <dl>
          <div>
            <dt>Cosecha inicial</dt>
            <dd>{proceso.harvest ? `${formatNumber(proceso.harvest.quantity)} ${proceso.harvest.unit}` : '—'}</dd>
          </div>
          <div>
            <dt>{proceso.finishedAt ? 'Terminado' : 'Inicio'}</dt>
            <dd>{formatDate(proceso.finishedAt ?? proceso.startedAt)}</dd>
          </div>
          <div>
            <dt>Avance</dt>
            <dd>{Math.round(avanceDe(proceso) * 100)} %</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{proceso.finishedAt ? 'Finalizado' : (etapaActual ?? proceso.currentStage)}</dd>
          </div>
        </dl>
      </div>

      <Card className="card-pad">
        <CardTitle title="Ruta recomendada" subtitle={tipo ? `Pasos del proceso ${tipo.nombre.toLowerCase()}${variante ? ` ${variante.toLowerCase()}` : ''}` : 'Elige el tipo al registrar la siguiente etapa para recibir recomendaciones'} />
        <Ruta ruta={ruta} hechas={hechas} siguiente={siguiente} eventos={proceso.events} />
        {siguiente && puedeEditar && !registrando && (
          <div className="cf-siguiente">
            <span className="cf-siguiente-emoji">{GUIA_ETAPAS[siguiente].emoji}</span>
            <div>
              <small>Siguiente recomendado</small>
              <strong>{siguiente}</strong>
              <p>{consejoDe(tipo, siguiente)}</p>
            </div>
            <div className="cf-siguiente-acciones">
              <Button onClick={() => setRegistrando(siguiente)}>
                Registrar {siguiente.toLowerCase()} <Icon name="arrow" size={16} />
              </Button>
              <Button variant="ghost" disabled={saving} onClick={() => void actualizar({ currentStage: siguiente })}>
                Pasar a {siguiente.toLowerCase()} sin datos
              </Button>
            </div>
          </div>
        )}
        {registrando && (
          <EtapaForm
            key={registrando}
            tipoInicial={tipo}
            variante={variante}
            etapaInicial={registrando}
            hechas={hechas}
            entradaSugerida={ultimaSalida(proceso)}
            guardando={evento.saving}
            error={evento.error}
            onSubmit={(p) => void guardarEtapa(p)}
            onCancel={() => setRegistrando(null)}
          />
        )}
      </Card>

      <Card className="card-pad">
        <CardTitle title="Etapas registradas" subtitle="Mediciones de cada etapa, incluido el manejo del agua del lavado">
          {puedeEditar && !registrando && !proceso.finishedAt && (
            <Button variant="secondary" icon="plus" onClick={() => setRegistrando(siguiente ?? 'Secado')}>
              Registrar etapa
            </Button>
          )}
        </CardTitle>
        {eventos.length === 0 && <p className="muted">Aún no se han registrado etapas con mediciones.</p>}
        <div className="cf-historial">
          {eventos.map((e) => (
            <FilaEvento key={e.id} evento={e} />
          ))}
        </div>
      </Card>

      {error && <ErrorNotice message={error} />}
      <Card className="process-note">
        <Icon name="sync" />
        <div>
          <strong>{proceso.finishedAt ? 'Proceso finalizado' : `${proceso.currentStage} en curso`}</strong>
          {editandoNotas ? (
            <form
              className="rec-form"
              onSubmit={(e) => {
                e.preventDefault()
                void actualizar({ notes: notas.trim() })
              }}
            >
              <TextAreaField label="Notas del proceso" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. Humedad actual 18,2 %, objetivo 10–12 %" />
              <div className="form-actions">
                <Button variant="ghost" onClick={() => setEditandoNotas(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  Guardar notas
                </Button>
              </div>
            </form>
          ) : (
            <span>{proceso.notes ?? 'Sin notas registradas.'}</span>
          )}
        </div>
        {puedeEditar && !editandoNotas && (
          <div className="note-actions">
            <Button variant="secondary" onClick={() => setEditandoNotas(true)}>
              Actualizar notas
            </Button>
            {!proceso.finishedAt && (
              <Button icon="check" variant={siguiente && !ETAPAS_FINALES.includes(siguiente) ? 'secondary' : 'primary'} disabled={saving} onClick={() => void actualizar({ finishedAt: new Date().toISOString() })}>
                Finalizar proceso
              </Button>
            )}
            {proceso.finishedAt && (
              <Button variant="ghost" disabled={saving} onClick={() => void actualizar({ finishedAt: null })}>
                Reabrir
              </Button>
            )}
          </div>
        )}
      </Card>

      <Card className="card-pad">
        <CardTitle title="Producto final" subtitle="Resultado del proceso y sus certificaciones">
          {puedeEditar && !agregandoProducto && (
            <Button variant="secondary" icon="plus" onClick={() => setAgregandoProducto(true)}>
              Registrar producto
            </Button>
          )}
        </CardTitle>
        {agregandoProducto && (
          <ProductoForm
            processId={proceso.id}
            onCancel={() => setAgregandoProducto(false)}
            onSaved={() => {
              setAgregandoProducto(false)
              onChanged()
            }}
          />
        )}
        {proceso.products.length === 0 && !agregandoProducto && <p className="muted">Este proceso todavía no tiene producto final registrado.</p>}
        {proceso.products.map((p) => (
          <Producto key={p.id} producto={p} puedeCertificar={puedeCertificar} onChanged={onChanged} />
        ))}
      </Card>
    </section>
  )
}

/** Cuando lo que sigue es opcional, finalizar pasa a ser la acción principal. */
const ETAPAS_FINALES: EtapaCafe[] = ['Tostión', 'Catación']

function FilaEvento({ evento: e }: { evento: CoffeeProcessEvent }) {
  const metodo = leerMetodo(e.method)
  const etapa = esEtapa(e.stage) ? GUIA_ETAPAS[e.stage] : null
  const horas = e.durationHours != null ? Number(e.durationHours) : null
  const datos = [
    e.inputKg != null && e.outputKg != null ? `${formatNumber(e.inputKg)} → ${formatNumber(e.outputKg)} kg` : e.outputKg != null ? `${formatNumber(e.outputKg)} kg` : e.inputKg != null ? `${formatNumber(e.inputKg)} kg` : null,
    horas != null ? (e.stage === 'Secado' ? `${formatNumber(horas / 24)} días` : e.stage === 'Tostión' ? `${formatNumber(horas * 60)} min` : `${formatNumber(horas)} h`) : null,
    e.moisturePercent != null ? `Humedad ${formatNumber(e.moisturePercent)} %` : null,
    e.brix != null ? `${formatNumber(e.brix)} °Brix` : null,
    e.ph != null ? `pH ${formatNumber(e.ph)}` : null,
    e.waterLiters != null ? `Agua limpia ${formatNumber(e.waterLiters)} L` : null,
    e.wastewaterLiters != null ? `Aguas mieles ${formatNumber(e.wastewaterLiters)} L` : null,
    e.wastewaterDestination ? `Destino: ${e.wastewaterDestination}` : e.stage === 'Lavado' && e.compostReuse ? 'Reutilizada en compostaje' : null,
    e.scaScore != null ? `SCA ${formatNumber(e.scaScore)}` : null,
    metodo.tecnica,
  ].filter(Boolean)
  return (
    <article className="cf-evento">
      <span className="cf-evento-emoji" aria-hidden="true">
        {etapa?.emoji ?? '•'}
      </span>
      <div>
        <header>
          <strong>{e.stage}</strong>
          <time dateTime={e.recordedAt}>{formatShortDate(e.recordedAt)}</time>
        </header>
        {datos.length > 0 && (
          <div className="cf-evento-datos">
            {datos.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
        )}
        {e.notes && <p>{e.notes}</p>}
      </div>
    </article>
  )
}

function NuevoProceso({
  farmId,
  cosechas,
  lotes,
  onVerGuia,
  onSaved,
  onCancel,
}: {
  farmId: string
  cosechas: Labor[]
  lotes: Lot[]
  onVerGuia: (t: TipoProceso) => void
  onSaved: (id: string) => void
  onCancel: () => void
}) {
  const crear = useApiMutation()
  const evento = useApiMutation()
  // Si el proceso se creó pero falló su primera etapa, el reintento solo guarda la etapa.
  const [creadoId, setCreadoId] = useState<string | null>(null)
  const [paso, setPaso] = useState(1)
  const [harvestId, setHarvestId] = useState('')
  const [lotId, setLotId] = useState(lotes.length === 1 ? lotes[0].id : '')
  const [tipo, setTipo] = useState<TipoProceso | null>(null)
  const [variante, setVariante] = useState<string | null>(null)
  const cosecha = cosechas.find((c) => c.harvest?.id === harvestId)
  const loteDeCosecha = cosecha ? (cosecha.lotId ?? cosecha.crop?.lotId ?? '') : ''
  const lote = loteDeCosecha || lotId
  const listoTipo = tipo && (!tipo.variantes?.length || variante)

  async function guardar(payload: EventoPayload) {
    let id = creadoId
    if (!id) {
      const proceso = await crear.mutate<CoffeeProcess>('/coffee-processes', 'POST', {
        farmId,
        harvestId: harvestId || undefined,
        lotId: lote || undefined,
        currentStage: payload.stage,
        startedAt: payload.recordedAt,
      })
      if (!proceso) return
      id = proceso.id
      setCreadoId(id)
    }
    if (await evento.mutate(`/coffee-processes/${id}/events`, 'POST', payload)) onSaved(id)
  }

  return (
    <Card className="cf-nuevo">
      <div className="cf-nuevo-cabeza">
        <div>
          <small>Nuevo proceso · paso {paso} de 3</small>
          <h2>{paso === 1 ? '¿De dónde viene el café?' : paso === 2 ? '¿Qué proceso vas a hacer?' : `Empecemos: ${tipo!.etapas[0].toLowerCase()}`}</h2>
        </div>
        <ol className="cf-pasos" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <li key={n} className={n <= paso ? 'hecho' : ''} />
          ))}
        </ol>
      </div>

      {paso === 1 && (
        <>
          <div className="cf-opciones">
            {lotes.map((l) => (
              <button type="button" key={l.id} className={lote === l.id ? 'activo' : ''} aria-pressed={lote === l.id} disabled={Boolean(loteDeCosecha) && loteDeCosecha !== l.id} onClick={() => setLotId(l.id)}>
                <span>🌳</span>
                <strong>{l.name}</strong>
              </button>
            ))}
            {lotes.length === 0 && <p className="muted">Primero registra un lote en la finca.</p>}
          </div>
          <SelectField label="Cosecha de origen (opcional)" value={harvestId} onChange={(e) => setHarvestId(e.target.value)}>
            <option value="">Sin cosecha asociada</option>
            {cosechas.map((l) => (
              <option key={l.id} value={l.harvest!.id}>
                {formatShortDate(l.startDate)} · {l.name} · {formatNumber(l.harvest!.quantity)} {l.harvest!.unit}
              </option>
            ))}
          </SelectField>
        </>
      )}

      {paso === 2 && (
        <div className="cf-tipos">
          {TIPOS_PROCESO.map((t) => (
            <div key={t.id} className={`cf-tipo${tipo?.id === t.id ? ' activo' : ''}`}>
              <button
                type="button"
                className="cf-tipo-principal"
                aria-pressed={tipo?.id === t.id}
                onClick={() => {
                  if (tipo?.id !== t.id) setVariante(null)
                  setTipo(t)
                }}
              >
                <span className="cf-tipo-emoji">{t.emoji}</span>
                <span className="cf-tipo-texto">
                  <strong>
                    {t.nombre} {t.recomendado && <em>⭐ Recomendado</em>}
                  </strong>
                  <small>{t.resumen}</small>
                  <span className="cf-tipo-tags">
                    <i>☕ {t.taza}</i>
                    <i>⏱ {t.duracion}</i>
                    <i>{t.nivel}</i>
                  </span>
                  <span className="cf-tipo-pasos">{t.etapas.map((e) => `${GUIA_ETAPAS[e].emoji} ${e}`).join('  →  ')}</span>
                </span>
              </button>
              <button type="button" className="cf-tipo-guia" onClick={() => onVerGuia(t)}>
                Ver guía
              </button>
              {tipo?.id === t.id && t.variantes && (
                <div className="cf-variantes" role="group" aria-label="Tipo de honey">
                  {t.variantes.map((v) => (
                    <button type="button" key={v} className={variante === v ? 'activo' : ''} aria-pressed={variante === v} onClick={() => setVariante(v)}>
                      <strong>Honey {v.toLowerCase()}</strong>
                      <small>{EXPLICACION_VARIANTES[v]}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {paso === 3 && tipo && (
        <EtapaForm
          tipoInicial={tipo}
          variante={variante}
          etapaInicial={tipo.etapas[0]}
          hechas={new Set()}
          entradaSugerida={cosecha?.harvest && cosecha.harvest.unit === 'kg' ? Number(cosecha.harvest.quantity) : null}
          guardando={crear.saving || evento.saving}
          error={crear.error ?? evento.error}
          textoGuardar={(e) => `Crear proceso y guardar ${e.toLowerCase()}`}
          onSubmit={(p) => void guardar(p)}
          onCancel={() => (creadoId ? onSaved(creadoId) : setPaso(2))}
        />
      )}

      {paso < 3 && (
        <div className="form-actions">
          <Button variant="ghost" onClick={() => (paso === 1 ? onCancel() : setPaso(paso - 1))}>
            {paso === 1 ? 'Cancelar' : 'Atrás'}
          </Button>
          <Button disabled={paso === 1 ? !lote : !listoTipo} onClick={() => setPaso(paso + 1)}>
            Continuar <Icon name="arrow" size={16} />
          </Button>
        </div>
      )}
    </Card>
  )
}

function GuiaModal({ tipo, onClose }: { tipo: TipoProceso; onClose: () => void }) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onClose])
  return (
    <div className="cf-modal-fondo" onMouseDown={onClose}>
      <div className="cf-modal" role="dialog" aria-modal="true" aria-label={`Guía del proceso ${tipo.nombre}`} onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="cf-modal-cerrar" onClick={onClose} aria-label="Cerrar guía">
          <Icon name="close" />
        </button>
        <div className="cf-modal-cabeza">
          <span>{tipo.emoji}</span>
          <div>
            <h2>Proceso {tipo.nombre.toLowerCase()}</h2>
            <p>{tipo.resumen}</p>
          </div>
        </div>
        <div className="cf-tipo-tags">
          <i>☕ {tipo.taza}</i>
          <i>⏱ {tipo.duracion}</i>
          <i>{tipo.nivel}</i>
        </div>
        <ol className="cf-modal-pasos">
          {tipo.etapas.map((e, i) => (
            <li key={e}>
              <span>{GUIA_ETAPAS[e].emoji}</span>
              <div>
                <strong>
                  {i + 1}. {e}
                </strong>
                <small>{GUIA_ETAPAS[e].queEs}</small>
                <p>💡 {consejoDe(tipo, e)}</p>
              </div>
            </li>
          ))}
        </ol>
        {tipo.variantes && (
          <div className="cf-modal-variantes">
            {tipo.variantes.map((v) => (
              <p key={v}>
                <strong>Honey {v.toLowerCase()}:</strong> {EXPLICACION_VARIANTES[v]}
              </p>
            ))}
          </div>
        )}
        <p className="muted">Después puedes registrar tostión y catación si las haces.</p>
      </div>
    </div>
  )
}

const ESTADOS_CERTIFICACION = ['EN_TRAMITE', 'VIGENTE', 'VENCIDA'] as const
const ESTADO_CERTIFICACION_LABEL: Record<string, { label: string; tone: 'amber' | 'green' | 'gray' }> = {
  EN_TRAMITE: { label: 'En trámite', tone: 'amber' },
  VIGENTE: { label: 'Vigente', tone: 'green' },
  VENCIDA: { label: 'Vencida', tone: 'gray' },
}

function Producto({ producto, puedeCertificar, onChanged }: { producto: ProductFinal; puedeCertificar: boolean; onChanged: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const [certificando, setCertificando] = useState(false)
  const [certifier, setCertifier] = useState('')
  const [status, setStatus] = useState<string>('EN_TRAMITE')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (await mutate(`/coffee-processes/products/${producto.id}/certifications`, 'POST', { certifier: certifier.trim(), status })) {
      setCertificando(false)
      setCertifier('')
      onChanged()
    }
  }

  return (
    <div className="application-row" style={{ alignItems: 'start' }}>
      <div className="date-box">{formatShortDate(producto.finalizedAt)}</div>
      <div>
        <strong>{producto.destination ?? 'Producto final'}</strong>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {(producto.certifications ?? []).length === 0 && <span>Sin certificaciones</span>}
          {(producto.certifications ?? []).map((c) => {
            const estado = ESTADO_CERTIFICACION_LABEL[c.status] ?? { label: c.status, tone: 'gray' as const }
            return (
              <Chip key={c.id} tone={estado.tone}>
                {c.certifier} · {estado.label}
              </Chip>
            )
          })}
        </div>
        {certificando && (
          <form className="rec-form" onSubmit={onSubmit}>
            <div className="form-grid">
              <TextField label="Certificadora *" required value={certifier} onChange={(e) => setCertifier(e.target.value)} placeholder="Ej. Rainforest Alliance" />
              <SelectField label="Estado *" value={status} onChange={(e) => setStatus(e.target.value)}>
                {ESTADOS_CERTIFICACION.map((s) => (
                  <option key={s} value={s}>
                    {ESTADO_CERTIFICACION_LABEL[s].label}
                  </option>
                ))}
              </SelectField>
            </div>
            {error && <ErrorNotice message={error} />}
            <div className="form-actions">
              <Button variant="ghost" onClick={() => setCertificando(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !certifier.trim()}>
                Guardar certificación
              </Button>
            </div>
          </form>
        )}
      </div>
      {puedeCertificar && !certificando && (
        <Button variant="ghost" icon="plus" onClick={() => setCertificando(true)}>
          Certificación
        </Button>
      )}
    </div>
  )
}

function ProductoForm({ processId, onSaved, onCancel }: { processId: string; onSaved: () => void; onCancel: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const [destination, setDestination] = useState('')
  const [finalizedAt, setFinalizedAt] = useState(() => new Date().toISOString().slice(0, 10))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (await mutate(`/coffee-processes/${processId}/products`, 'POST', { destination: optionalText(destination), finalizedAt })) onSaved()
  }

  return (
    <form className="rec-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <TextField label="Producto o destino *" required value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Ej. Café tostado 340 g · tienda" />
        <TextField label="Fecha de finalización *" type="date" required value={finalizedAt} onChange={(e) => setFinalizedAt(e.target.value)} />
      </div>
      {error && <ErrorNotice message={error} />}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" icon="check" disabled={saving || !destination.trim()}>
          Guardar producto
        </Button>
      </div>
    </form>
  )
}
