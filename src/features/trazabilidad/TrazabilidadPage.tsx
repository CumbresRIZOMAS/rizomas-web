import { useState } from 'react'
import { useApiQuery } from '../../shared/api/hooks'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
import { Publicaciones } from './Publicaciones'
import type { Farm, FarmTraceability } from '../../shared/api/types'
import { RequireFarm } from '../../shared/farm/RequireFarm'
import { formatDate, formatHa, formatNumber, toNumber } from '../../shared/format'
import { harvestTotal, mainUnit } from '../../shared/harvest'
import { Button, Card, Chip, ErrorNotice, Icon, Loading, PageHeader, type IconName } from '../../shared/ui'
import { codigoProceso } from '../cafe/etapas'

export function TrazabilidadPage() {
  return <RequireFarm>{(farm) => <Trazabilidad farm={farm} />}</RequireFarm>
}

type Paso = { titulo: string; texto: string; icon: IconName; verificado?: boolean }

/**
 * Cadena finca → lote → cultivo → labores → análisis → cosecha → procesamiento
 * → producto final (RF-15). La vista pública es solo una previsualización: el
 * contenido que ven compradores sale del read model público del backend.
 */
function Trazabilidad({ farm }: { farm: Farm }) {
  const { role } = useAuth()
  const { data, error, loading, reload } = useApiQuery<FarmTraceability>(`/traceability/farms/${farm.id}`)
  const [publica, setPublica] = useState(true)

  if (loading && !data) return <Loading />
  if (error) return <ErrorNotice message={error} onRetry={reload} />
  if (!data) return null

  const cultivos = data.lots.flatMap((l) => l.crops)
  const variedades = [...new Set(cultivos.map((c) => [c.species, c.variety].filter(Boolean).join(' ')))]
  const analisis = data.lots.flatMap((l) => l.soilAnalyses).sort((a, b) => b.date.localeCompare(a.date))
  const recomendaciones = analisis.flatMap((a) => a.diagnostics.flatMap((d) => d.recommendations))
  const aplicaciones = data.lots.flatMap((l) => l.bioinputApplications ?? [])
  const bioinsumos = [...new Set(aplicaciones.map((a) => a.bioinput.name))]
  const unidad = mainUnit(data.labors)
  const cosechado = harvestTotal(data.labors, unidad)
  const areaLotes = data.lots.reduce((s, l) => s + (toNumber(l.areaHa) ?? 0), 0)
  const procesos = data.coffeeProcesses
  const productos = procesos.flatMap((p) => p.products)
  const certificaciones = productos.flatMap((p) => p.certifications ?? [])
  const ultimoProceso = procesos[0]

  const pasos: Paso[] = [
    {
      titulo: 'Finca',
      texto: publica
        ? `Región ${data.region ?? 'no registrada'}, Colombia`
        : `${data.name} · ${[data.municipality, data.region].filter(Boolean).join(', ') || 'Sin ubicación'}`,
      icon: 'farm',
    },
    { titulo: 'Lotes', texto: publica ? `${data.lots.length} lotes productivos` : `${data.lots.map((l) => l.name).join(', ') || 'Sin lotes'} · ${formatHa(areaLotes)}`, icon: 'leaf' },
    { titulo: 'Cultivo', texto: variedades.join(' · ') || 'Sin cultivos registrados', icon: 'coffee' },
    { titulo: 'Labores', texto: `${data.labors.length} prácticas agrícolas documentadas`, icon: 'tool' },
    {
      titulo: 'Análisis de suelo',
      texto: analisis.length ? `${analisis.length} análisis · último ${formatDate(analisis[0].date)}${!publica && analisis[0].laboratory ? ` (${analisis[0].laboratory})` : ''}` : 'Sin análisis registrados',
      icon: 'soil',
    },
    {
      titulo: 'Recomendaciones',
      texto: recomendaciones.length
        ? `${recomendaciones.length} recomendaciones · ${recomendaciones.filter((r) => r.type === 'BIOINSUMO').length} con bioinsumo`
        : 'Sin recomendaciones registradas',
      icon: 'leaf',
    },
    {
      titulo: 'Bioinsumos',
      texto: aplicaciones.length ? `${aplicaciones.length} aplicaciones · ${bioinsumos.join(', ')}` : 'Sin aplicaciones de bioinsumos',
      icon: 'drop',
    },
    { titulo: 'Cosecha', texto: cosechado > 0 ? `${formatNumber(cosechado)} ${unidad} cosechados` : 'Sin cosechas registradas', icon: 'coffee' },
    {
      titulo: 'Procesamiento',
      texto: procesos.length ? `${procesos.length} procesos · ${ultimoProceso.finishedAt ? 'último finalizado' : `último en ${ultimoProceso.currentStage.toLowerCase()}`}` : 'Sin procesos registrados',
      icon: 'process',
    },
    { titulo: 'Producto final', texto: productos.length ? `${productos.length} productos finales${productos[0].destination ? ` · ${productos[0].destination}` : ''}` : 'Sin producto final todavía', icon: 'coffee' },
    {
      titulo: 'Certificaciones',
      texto: certificaciones.length ? certificaciones.map((c) => c.certifier).join(' · ') : 'Sin certificaciones registradas',
      icon: 'report',
      verificado: certificaciones.length > 0,
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow={ultimoProceso ? `Proceso ${codigoProceso(ultimoProceso)}` : `Finca ${farm.name}`}
        title="Trazabilidad del producto"
        subtitle="Del origen al producto final, con información verificable."
        actions={
          <label className="public-toggle">
            <span>
              <Icon name={publica ? 'users' : 'lock'} />
              Vista pública
            </span>
            <input type="checkbox" checked={publica} onChange={() => setPublica(!publica)} />
            <i />
          </label>
        }
      />
      <div className="privacy-note">
        <Icon name={publica ? 'users' : 'lock'} />
        <div>
          <strong>{publica ? 'Vista para compradores y certificadoras' : 'Vista interna de Cumbres Sacras SAS'}</strong>
          <span>{publica ? 'Se ocultan nombres, coordenadas exactas, costos, transacciones y datos personales.' : 'Incluye información privada y datos completos de operación.'}</span>
        </div>
      </div>
      <div className="trace-layout">
        <div className="trace-line">
          {pasos.map((p, i) => (
            <div className="trace-item" key={p.titulo}>
              <div className="trace-node">
                <Icon name={p.icon} />
              </div>
              <Card>
                <span>Paso {i + 1}</span>
                <h2>{p.titulo}</h2>
                <p>{p.texto}</p>
                {p.verificado && (
                  <Chip tone="green">
                    <Icon name="check" size={13} /> Verificada
                  </Chip>
                )}
              </Card>
            </div>
          ))}
        </div>
        <Card className="product-card">
          <div className="product-pack">
            <Icon name="coffee" size={48} />
            <strong>RIZOMAS</strong>
            <span>Café de origen</span>
          </div>
          <h2>{variedades[0] ?? 'Café de origen'}</h2>
          <p>{publica ? `Región ${data.region ?? 'Colombia'}` : `Finca ${data.name}`}</p>
          <p className="muted">{ultimoProceso ? `Proceso ${codigoProceso(ultimoProceso)} · ${ultimoProceso.currentStage}` : 'Sin procesos registrados'}</p>
          <div style={{ marginTop: 14 }}>
            <Button variant="secondary" onClick={() => window.print()}>
              Descargar ficha
            </Button>
          </div>
        </Card>
      </div>
      {canDo(role, ROLES.publicar) && (
        <div style={{ marginTop: 14 }}>
          <Publicaciones farm={farm} traza={data} />
        </div>
      )}
    </div>
  )
}
