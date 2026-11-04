// Bibliografía del portal público: todas las fuentes de datos, mapas y
// contenidos que usa la página. Si se agrega una capa o un dato nuevo al
// mapa, su fuente se registra aquí.

import { useEffect, useState } from 'react'
import './bibliografia.css'

type Fuente = { autor: string; titulo: string; detalle?: string; url: string; uso: string }

const FECHA_CONSULTA = '3 de noviembre de 2026'

const GRUPOS: { titulo: string; fuentes: Fuente[] }[] = [
  {
    titulo: 'Datos del café',
    fuentes: [
      {
        autor: 'UPRA y Ministerio de Agricultura y Desarrollo Rural',
        titulo: 'Evaluaciones Agropecuarias Municipales – EVA 2019-2025. Base agrícola',
        detalle: 'Conjunto de datos abiertos, datos.gov.co (uejq-wxrr).',
        url: 'https://www.datos.gov.co/d/uejq-wxrr',
        uso: 'Producción y área sembrada de café por municipio y departamento (2025).',
      },
      {
        autor: 'Federación Nacional de Cafeteros de Colombia',
        titulo: 'Exportaciones de café colombiano',
        detalle: 'Estadísticas cafeteras, archivo actualizado a septiembre de 2026.',
        url: 'https://federaciondecafeteros.org/wp/estadisticas-cafeteras/',
        uso: 'Destinos, puertos de embarque y tipos de café exportado (2025).',
      },
      {
        autor: 'Café de Colombia – Federación Nacional de Cafeteros',
        titulo: 'Denominación de origen regional',
        url: 'https://cafedecolombia.com/denominacion-de-origen-regional/',
        uso: 'Perfiles de taza, factores de calidad y resoluciones de las denominaciones de origen de Huila, Cauca, Nariño, Santander y Sierra Nevada.',
      },
      {
        autor: 'Superintendencia de Industria y Comercio',
        titulo: 'Resolución 2458 de 2017: Denominación de Origen Café de Tolima',
        url: 'https://cafedecolombia.com/wp-content/uploads/2021/06/Res.-2458-DO-Tolima.pdf',
        uso: 'Protección de la denominación de origen Café de Tolima.',
      },
      {
        autor: 'Cenicafé',
        titulo: 'Publicaciones técnicas sobre las denominaciones de origen del café',
        url: 'https://publicaciones.cenicafe.org/',
        uso: 'Perfil de taza del Café de Tolima y número de municipios que cubre.',
      },
      {
        autor: 'ProColombia – Colombia Travel',
        titulo: 'Regiones de café',
        url: 'https://colombia.travel/es/regiones-de-cafe',
        uso: 'Participación de los caficultores arhuacos en la Sierra Nevada.',
      },
      {
        autor: 'UNESCO – Centro del Patrimonio Mundial',
        titulo: 'Paisaje Cultural Cafetero de Colombia (inscrito en 2011)',
        url: 'https://whc.unesco.org/es/list/1121',
        uso: 'Reconocimiento del Paisaje Cultural Cafetero como Patrimonio de la Humanidad.',
      },
      {
        autor: 'Wikipedia',
        titulo: 'Paisaje cultural cafetero',
        detalle: 'Licencia CC BY-SA 4.0.',
        url: 'https://es.wikipedia.org/wiki/Paisaje_cultural_cafetero',
        uso: 'Lista de municipios del área principal del Paisaje Cultural Cafetero.',
      },
    ],
  },
  {
    titulo: 'Naturaleza',
    fuentes: [
      {
        autor: 'Parques Nacionales Naturales de Colombia',
        titulo: 'Registro Único Nacional de Áreas Protegidas – RUNAP',
        detalle: 'Capa geográfica descargada en su versión más reciente.',
        url: 'https://runap.parquesnacionales.gov.co/',
        uso: 'Parques, reservas y demás áreas protegidas, con su categoría, área y entidad que las administra.',
      },
      {
        autor: 'Ministerio de Ambiente y Desarrollo Sostenible e Instituto Humboldt',
        titulo: 'Páramos delimitados',
        detalle: 'Polígonos con sus resoluciones de delimitación, publicados como servicio geográfico.',
        url: 'https://services9.arcgis.com/pZylgd2zhNey2qXF/ArcGIS/rest/services/P%c3%a1ramos/FeatureServer',
        uso: 'Complejos de páramo, su área y su acto de delimitación.',
      },
      {
        autor: 'Natural Earth',
        titulo: 'Rivers + lake centerlines, escala 1:10m',
        detalle: 'Dominio público.',
        url: 'https://www.naturalearthdata.com/',
        uso: 'Trazado y nombre de los ríos principales.',
      },
    ],
  },
  {
    titulo: 'Cartografía y mapas base',
    fuentes: [
      {
        autor: 'DANE',
        titulo: 'Marco Geoestadístico Nacional 2025',
        detalle: 'Simplificación de mapas-colombia (Y. Tolosa), licencia CC BY 4.0.',
        url: 'https://github.com/ytolosa/mapas-colombia',
        uso: 'Límites de municipios y departamentos, y centro de cada municipio para ubicar las fincas.',
      },
      {
        autor: 'OpenFreeMap, OpenMapTiles y colaboradores de OpenStreetMap',
        titulo: 'Mapa base vectorial',
        detalle: 'Datos © colaboradores de OpenStreetMap, licencia ODbL.',
        url: 'https://www.openstreetmap.org/copyright',
        uso: 'Mapa de relieve, vías, poblaciones y etiquetas.',
      },
      {
        autor: 'Esri, Maxar y Earthstar Geographics',
        titulo: 'World Imagery',
        url: 'https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9',
        uso: 'Vista de satélite.',
      },
      {
        autor: 'Mapzen y Amazon Web Services',
        titulo: 'Terrain Tiles (Registry of Open Data on AWS)',
        url: 'https://registry.opendata.aws/terrain-tiles/',
        uso: 'Elevación del terreno para el relieve 3D.',
      },
      {
        autor: 'MapLibre',
        titulo: 'MapLibre GL JS',
        detalle: 'Software libre, licencia BSD-3-Clause.',
        url: 'https://maplibre.org/',
        uso: 'Motor del mapa interactivo y la vista de globo.',
      },
    ],
  },
  {
    titulo: 'Fotografías',
    fuentes: [
      {
        autor: 'Unsplash',
        titulo: 'Fotografías de paisajes cafeteros',
        detalle: 'Licencia de Unsplash. Son ilustrativas y no corresponden a una finca en particular.',
        url: 'https://unsplash.com/license',
        uso: 'Imágenes decorativas de la portada y las secciones de la página.',
      },
    ],
  },
]

/** Muestra la URL sin protocolo; si es muy larga, solo el dominio. */
function enlaceCorto(url: string) {
  const sinProtocolo = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  return sinProtocolo.length > 48 ? new URL(url).hostname.replace(/^www\./, '') : sinProtocolo
}

const TOTAL_FUENTES = GRUPOS.reduce((n, g) => n + g.fuentes.length, 0)

/**
 * Tarjeta compacta y cerrada por defecto: solo se despliega si alguien quiere
 * ver las fuentes. Los enlaces a #fuentes (por ejemplo, desde el mapa) la abren.
 */
export function Bibliografia() {
  const [abierta, setAbierta] = useState(false)

  useEffect(() => {
    const abrirSiCorresponde = () => {
      if (window.location.hash === '#fuentes') setAbierta(true)
    }
    const alClic = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('a[href="#fuentes"]')) setAbierta(true)
    }
    abrirSiCorresponde()
    window.addEventListener('hashchange', abrirSiCorresponde)
    document.addEventListener('click', alClic)
    return () => {
      window.removeEventListener('hashchange', abrirSiCorresponde)
      document.removeEventListener('click', alClic)
    }
  }, [])

  return (
    <section className="public-bibliografia" id="fuentes" aria-label="Fuentes y créditos">
      <div className={`bibliografia-card${abierta ? ' abierta' : ''}`}>
        <button type="button" className="bibliografia-cabeza" aria-expanded={abierta} aria-controls="bibliografia-contenido" onClick={() => setAbierta(!abierta)}>
          <span className="bibliografia-icono" aria-hidden="true">
            📚
          </span>
          <span className="bibliografia-resumen">
            <strong>Fuentes y créditos</strong>
            <small>
              {TOTAL_FUENTES} fuentes oficiales y abiertas · consultadas el {FECHA_CONSULTA}
            </small>
          </span>
          <span className="bibliografia-accion">{abierta ? 'Ocultar' : 'Ver fuentes'}</span>
          <span className="bibliografia-flecha" aria-hidden="true" />
        </button>
        {abierta && (
          <div className="bibliografia-contenido" id="bibliografia-contenido">
            <p className="bibliografia-intro">
              La información de contexto del mapa viene de fuentes oficiales y abiertas. Los datos de las fincas los registran ellas mismas en RIZOMAS y solo
              se muestra lo que autorizan publicar.
            </p>
            <div className="bibliografia-grupos">
              {GRUPOS.map((grupo) => (
                <div key={grupo.titulo}>
                  <h3>{grupo.titulo}</h3>
                  <ol>
                    {grupo.fuentes.map((f) => (
                      <li key={f.url + f.titulo}>
                        <p>
                          {f.autor}. <cite>{f.titulo}</cite>.{f.detalle ? ` ${f.detalle}` : ''}{' '}
                          <a href={f.url} target="_blank" rel="noreferrer">
                            {enlaceCorto(f.url)}
                          </a>
                        </p>
                        <small>Uso: {f.uso}</small>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
