import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import { EXPLICACION_VARIANTES, GUIA_ETAPAS, TIPOS_PROCESO, consejoDe, type TipoProceso } from '../cafe/guiaBeneficio'

// Color de cada proceso (acento de la tarjeta y de su línea de tiempo).
const COLOR: Record<TipoProceso['id'], string> = {
  lavado: '#3f87a6',
  honey: '#c98a1e',
  natural: '#b0453a',
  anaerobico: '#6c58a6',
}

/**
 * Tipos de café según su proceso de beneficio. Usa la misma guía que siguen
 * los agricultores en la app al registrar cada etapa.
 */
export function TiposDeCafe() {
  const [activo, setActivo] = useState<TipoProceso['id']>('lavado')
  const tipo = TIPOS_PROCESO.find((t) => t.id === activo) ?? TIPOS_PROCESO[0]

  const onTecla = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const i = TIPOS_PROCESO.findIndex((t) => t.id === activo)
    const siguiente = TIPOS_PROCESO[(i + (e.key === 'ArrowRight' ? 1 : -1) + TIPOS_PROCESO.length) % TIPOS_PROCESO.length]
    setActivo(siguiente.id)
    document.getElementById(`tipo-tab-${siguiente.id}`)?.focus()
  }

  return (
    <section className="pp-section pp-tipos" id="tipos-de-cafe" aria-labelledby="tipos-titulo">
      <div className="pp-section-head">
        <span className="pp-kicker">Tipos de café</span>
        <h2 id="tipos-titulo">Un mismo grano, sabores distintos</h2>
        <p>
          Lo que pasa después de la cosecha cambia la taza. Estos son los procesos que siguen los agricultores en RIZOMAS, etapa por etapa, con los
          consejos que usan en la finca.
        </p>
      </div>

      <div className="pp-tipos-tabs" role="tablist" aria-label="Procesos del café" onKeyDown={onTecla}>
        {TIPOS_PROCESO.map((t) => (
          <button
            key={t.id}
            id={`tipo-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={t.id === activo}
            aria-controls="tipo-panel"
            tabIndex={t.id === activo ? 0 : -1}
            className={t.id === activo ? 'activo' : ''}
            style={{ '--tipo': COLOR[t.id] } as CSSProperties}
            onClick={() => setActivo(t.id)}
          >
            <span className="pp-tipo-emoji" aria-hidden="true">
              {t.emoji}
            </span>
            <span>
              <strong>{t.nombre}</strong>
              <small>{t.taza}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="pp-tipo-panel" id="tipo-panel" role="tabpanel" aria-labelledby={`tipo-tab-${tipo.id}`} style={{ '--tipo': COLOR[tipo.id] } as CSSProperties} key={tipo.id}>
        <div className="pp-tipo-info">
          <div className="pp-tipo-titulo">
            <span className="pp-tipo-emoji grande" aria-hidden="true">
              {tipo.emoji}
            </span>
            <div>
              <h3>Café {tipo.nombre.toLowerCase()}</h3>
              {tipo.recomendado && <span className="pp-tipo-sello">El más común en Colombia</span>}
            </div>
          </div>
          <p>{tipo.resumen}</p>
          <dl className="pp-tipo-datos">
            <div>
              <dt>En la taza</dt>
              <dd>{tipo.taza}</dd>
            </div>
            <div>
              <dt>Duración</dt>
              <dd>{tipo.duracion}</dd>
            </div>
            <div>
              <dt>Dificultad</dt>
              <dd>{tipo.nivel}</dd>
            </div>
            <div>
              <dt>Etapas</dt>
              <dd>{tipo.etapas.length}</dd>
            </div>
          </dl>
          {tipo.variantes && (
            <div className="pp-tipo-variantes">
              <small>Variantes</small>
              <ul>
                {tipo.variantes.map((v) => (
                  <li key={v}>
                    <b>{v}</b> {EXPLICACION_VARIANTES[v]}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <ol className="pp-tipo-etapas" aria-label={`Etapas del café ${tipo.nombre.toLowerCase()}`}>
          {tipo.etapas.map((etapa, i) => {
            const guia = GUIA_ETAPAS[etapa]
            return (
              <li key={etapa}>
                <span className="pp-etapa-marca" aria-hidden="true">
                  {guia.emoji}
                </span>
                <div>
                  <small>Etapa {i + 1}</small>
                  <strong>{etapa}</strong>
                  <p>{guia.queEs}</p>
                  <p className="pp-etapa-consejo">{consejoDe(tipo, etapa)}</p>
                </div>
              </li>
            )
          })}
          <li className="pp-etapa-final">
            <span className="pp-etapa-marca" aria-hidden="true">
              ☕
            </span>
            <div>
              <small>Después</small>
              <strong>Tostión y catación</strong>
              <p>El café verde se tuesta y se califica la taza. Con 80 puntos o más en la escala SCA es café de especialidad.</p>
            </div>
          </li>
        </ol>
      </div>
    </section>
  )
}
