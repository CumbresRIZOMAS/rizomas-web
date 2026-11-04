#!/usr/bin/env python3
"""
Genera las capas de contexto del mapa público (public/mapa/*).

Descarga datos abiertos oficiales, los cruza y los simplifica para que el
navegador los cargue rápido. Se corre a mano cuando se quieran actualizar:

    python3 scripts/datos-mapa/generar.py --fnc-expo <url-xlsx-exportaciones>

Requisitos: Python 3.10+ con openpyxl y Node (usa `npx mapshaper`).
Fuentes (ver también public/mapa/fuentes.json, que se genera aquí):
  - Producción de café por municipio: UPRA / MinAgricultura, Evaluaciones
    Agropecuarias Municipales (EVA) 2019-2025, datos.gov.co (uejq-wxrr).
  - Áreas protegidas: RUNAP, Parques Nacionales Naturales de Colombia.
  - Páramos delimitados: MinAmbiente / Instituto Humboldt (resoluciones de delimitación).
  - Ríos principales: Natural Earth 1:10m (dominio público).
  - Municipios: DANE MGN 2025, simplificación mapas-colombia (CC BY 4.0).
  - Exportaciones: Federación Nacional de Cafeteros, estadísticas de exportación.
  - Denominaciones de origen: cafedecolombia.com (FNC) y resoluciones de la SIC.
  - Paisaje Cultural Cafetero: municipios del área principal (UNESCO, 2011).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import unicodedata
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SALIDA = RAIZ / 'public' / 'mapa'
MAPSHAPER = ['npx', '--yes', 'mapshaper@0.7.101']
ANIO_EVA = '2025'

URL_MUNICIPIOS = 'https://raw.githubusercontent.com/ytolosa/mapas-colombia/main/output/geojson/col_municipios_real_nacional.geojson'
URL_EVA = 'https://www.datos.gov.co/resource/uejq-wxrr.json'
URL_RUNAP = 'https://storage.googleapis.com/pnn_geodatabase/runap/latest.zip'
URL_PARAMOS = 'https://services9.arcgis.com/pZylgd2zhNey2qXF/ArcGIS/rest/services/P%C3%A1ramos/FeatureServer/2/query'
URL_RIOS = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson'
URL_FNC_EXPO = 'https://federaciondecafeteros.org/wp-content/uploads/2026/10/Exportaciones-Septiembre-2026.xlsx'

# Municipios con veredas en el área principal del Paisaje Cultural Cafetero (UNESCO 2011).
PCC = {
    'CALDAS': ['AGUADAS', 'ANSERMA', 'ARANZAZU', 'BELALCAZAR', 'CHINCHINA', 'FILADELFIA', 'LA MERCED', 'MANIZALES', 'NEIRA', 'PACORA',
               'PALESTINA', 'RIOSUCIO', 'RISARALDA', 'SALAMINA', 'SAN JOSE', 'SUPIA', 'VILLAMARIA'],
    'QUINDIO': ['ARMENIA', 'BUENAVISTA', 'CALARCA', 'CIRCASIA', 'CORDOBA', 'FILANDIA', 'GENOVA', 'MONTENEGRO', 'PIJAO', 'QUIMBAYA', 'SALENTO'],
    'RISARALDA': ['APIA', 'BALBOA', 'BELEN DE UMBRIA', 'DOSQUEBRADAS', 'GUATICA', 'LA CELIA', 'MARSELLA', 'PEREIRA', 'QUINCHIA',
                  'SANTA ROSA DE CABAL', 'SANTUARIO'],
    'VALLE DEL CAUCA': ['ALCALA', 'ANSERMANUEVO', 'ARGELIA', 'CAICEDONIA', 'EL AGUILA', 'EL CAIRO', 'RIOFRIO', 'SEVILLA', 'TRUJILLO', 'ULLOA'],
}

# Denominaciones de origen regionales: los municipios cafeteros de cada departamento.
# La Sierra Nevada cubre 33 municipios de Magdalena, La Guajira y Cesar alrededor del macizo;
# se aproxima con los municipios cafeteros de esos departamentos dentro de la caja de la Sierra.
DOP_DEPARTAMENTO = {'HUILA': 'huila', 'CAUCA': 'cauca', 'NARINO': 'narino', 'SANTANDER': 'santander', 'TOLIMA': 'tolima'}
SIERRA_DEPARTAMENTOS = {'MAGDALENA', 'LA GUAJIRA', 'CESAR'}
SIERRA_CAJA = (-74.45, 9.95, -72.75, 11.45)  # lon_min, lat_min, lon_max, lat_max

PUERTOS = {
    'Insp. Buenaventura': ('Buenaventura', 3.8801, -77.0312),
    'Insp. Cartagena': ('Cartagena', 10.3910, -75.4794),
    'Insp. Santa Marta': ('Santa Marta', 11.2408, -74.2110),
    'Insp. Barranquilla': ('Barranquilla', 10.9639, -74.7964),
    'Aerp. El Dorado': ('Aeropuerto El Dorado (Bogotá)', 4.7016, -74.1469),
    'Aerp. José M.Cordoba': ('Aeropuerto José María Córdova (Rionegro)', 6.1645, -75.4231),
    'Ipiales': ('Ipiales (frontera con Ecuador)', 0.8303, -77.6440),
    'Cucúta': ('Cúcuta (frontera con Venezuela)', 7.8939, -72.5078),
}

# Coordenadas aproximadas (centro del país) de los destinos del café, con nombre en inglés.
PAISES = {
    'EE.UU.': ('United States', 39.5, -98.35), 'Canadá': ('Canada', 56.1, -106.3), 'Alemania': ('Germany', 51.2, 10.4),
    'Bélgica': ('Belgium', 50.5, 4.5), 'Japón': ('Japan', 36.2, 138.3), 'Corea del Sur': ('South Korea', 35.9, 127.8),
    'China': ('China', 35.9, 104.2), 'Países Bajos': ('Netherlands', 52.1, 5.3), 'España': ('Spain', 40.5, -3.7),
    'Australia': ('Australia', -25.3, 133.8), 'Reino Unido': ('United Kingdom', 54.0, -2.0), 'México': ('Mexico', 23.6, -102.6),
    'Francia': ('France', 46.2, 2.2), 'Italia': ('Italy', 41.9, 12.6), 'Noruega': ('Norway', 60.5, 8.5),
    'Arabia Saudí': ('Saudi Arabia', 23.9, 45.1), 'Finlandia': ('Finland', 61.9, 25.7), 'Ecuador': ('Ecuador', -1.8, -78.2),
    'Malasia': ('Malaysia', 4.2, 102.0), 'Suecia': ('Sweden', 60.1, 18.6), 'Israel': ('Israel', 31.0, 34.9),
    'Taiwan': ('Taiwan', 23.7, 121.0), 'Turquía': ('Türkiye', 39.0, 35.2), 'Chile': ('Chile', -35.7, -71.5),
    'Grecia': ('Greece', 39.1, 21.8), 'Portugal': ('Portugal', 39.4, -8.2), 'Polonia': ('Poland', 51.9, 19.1),
    'Argentina': ('Argentina', -38.4, -63.6), 'Vietnam': ('Vietnam', 14.1, 108.3), 'Nueva Zelanda': ('New Zealand', -40.9, 174.9),
}


def norm(texto: str) -> str:
    texto = ''.join(c for c in unicodedata.normalize('NFD', texto or '') if unicodedata.category(c) != 'Mn')
    return ' '.join(texto.upper().replace('.', ' ').split())


def descargar(url: str, destino: Path, timeout: int = 600) -> Path:
    if destino.exists() and destino.stat().st_size > 0:
        return destino
    print(f'  descargando {url[:90]}…')
    req = urllib.request.Request(url, headers={'User-Agent': 'rizomas-datos-mapa/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r, open(destino, 'wb') as f:
        while bloque := r.read(1 << 20):
            f.write(bloque)
    return destino


def mapshaper(*args: str) -> None:
    subprocess.run([*MAPSHAPER, *args], check=True)


def guardar_json(ruta: Path, datos) -> None:
    ruta.write_text(json.dumps(datos, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


def eva(tmp: Path) -> dict[str, dict]:
    consulta = {
        '$select': 'c_digo_dane_municipio,departamento,municipio,sum(producci_n) as t,sum(rea_sembrada) as h',
        '$where': f"cultivo='Café' and a_o='{ANIO_EVA}'",
        '$group': 'c_digo_dane_municipio,departamento,municipio',
        '$limit': '5000',
    }
    ruta = descargar(f'{URL_EVA}?{urllib.parse.urlencode(consulta)}', tmp / f'eva{ANIO_EVA}.json')
    filas = json.loads(ruta.read_text(encoding='utf-8'))
    return {f['c_digo_dane_municipio'].zfill(5): {'t': float(f['t']), 'h': float(f['h'])} for f in filas if float(f['t']) > 0}


def capa_municipios(tmp: Path, produccion: dict[str, dict]) -> dict:
    """Municipios cafeteros con producción, DOP y marca de Paisaje Cultural Cafetero."""
    municipios = json.loads(descargar(URL_MUNICIPIOS, tmp / 'municipios.geojson').read_text(encoding='utf-8'))
    pcc = {(d, m) for d, lista in PCC.items() for m in lista}
    ranking = {c: i + 1 for i, (c, _) in enumerate(sorted(produccion.items(), key=lambda kv: -kv[1]['t']))}
    salida, por_departamento, pcc_geom = [], {}, []
    for f in municipios['features']:
        p = f['properties']
        codigo = str(p['divipola_mun']).zfill(5)
        dpto, mpio = norm(p['dpto_nombre']), norm(p['mpio_nombre'])
        if (dpto, mpio) in pcc:
            pcc_geom.append({'type': 'Feature', 'properties': {}, 'geometry': f['geometry']})
        datos = produccion.get(codigo)
        if not datos:
            continue
        dop = DOP_DEPARTAMENTO.get(dpto)
        if dpto in SIERRA_DEPARTAMENTOS:
            xs = [c[0] for anillo in _anillos(f['geometry']) for c in anillo]
            ys = [c[1] for anillo in _anillos(f['geometry']) for c in anillo]
            cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
            if SIERRA_CAJA[0] <= cx <= SIERRA_CAJA[2] and SIERRA_CAJA[1] <= cy <= SIERRA_CAJA[3]:
                dop = 'sierra'
        es_pcc = (dpto, mpio) in pcc
        dep = por_departamento.setdefault(p['dpto_nombre'], {'t': 0.0, 'h': 0.0, 'n': 0})
        dep['t'] += datos['t']
        dep['h'] += datos['h']
        dep['n'] += 1
        props = {'c': codigo, 'm': p['mpio_nombre'], 'd': p['dpto_nombre'], 't': round(datos['t'], 1), 'h': round(datos['h'], 1), 'r': ranking[codigo]}
        if dop:
            props['dop'] = dop
        if es_pcc:
            props['pcc'] = 1
        salida.append({'type': 'Feature', 'properties': props, 'geometry': f['geometry']})
    if len(pcc_geom) != sum(len(v) for v in PCC.values()):
        print(f'  aviso: solo se cruzaron {len(pcc_geom)} municipios del Paisaje Cultural Cafetero')
    crudo = tmp / 'cafe-municipios-crudo.geojson'
    guardar_json(crudo, {'type': 'FeatureCollection', 'features': salida})
    mapshaper(str(crudo), '-simplify', '6%', 'keep-shapes', '-o', 'precision=0.0001', 'format=geojson', str(SALIDA / 'cafe-municipios.geojson'))
    mapshaper(str(crudo), '-filter', 'dop != null', '-dissolve', 'dop', '-simplify', '8%', 'keep-shapes',
              '-o', 'precision=0.0001', 'format=geojson', str(SALIDA / 'denominaciones.geojson'))
    crudo_pcc = tmp / 'pcc-crudo.geojson'
    guardar_json(crudo_pcc, {'type': 'FeatureCollection', 'features': pcc_geom})
    mapshaper(str(crudo_pcc), '-dissolve', '-simplify', '10%', 'keep-shapes',
              '-o', 'precision=0.0001', 'format=geojson', str(SALIDA / 'paisaje-cultural-cafetero.geojson'))
    return {'municipios': len(salida), 'departamentos': por_departamento}


def _anillos(geom: dict):
    return geom['coordinates'] if geom['type'] == 'Polygon' else [a for poly in geom['coordinates'] for a in poly]


def capa_runap(tmp: Path) -> int:
    zip_ruta = descargar(URL_RUNAP, tmp / 'runap.zip', timeout=1200)
    carpeta = tmp / 'runap'
    if not carpeta.exists():
        with zipfile.ZipFile(zip_ruta) as z:
            z.extractall(carpeta)
    shp = next(carpeta.rglob('*.shp'))
    # Las áreas pequeñas (casi todas reservas naturales de la sociedad civil) van como puntos.
    comun = [str(shp), 'encoding=utf8', '-filter-fields', 'ap_nombre,ap_categor,area_ha_to,organizaci,url',
             '-rename-fields', 'n=ap_nombre,c=ap_categor,ha=area_ha_to,o=organizaci,u=url', '-each', 'ha = Math.round(ha)']
    poligonos, puntos = SALIDA / 'areas-protegidas.geojson', SALIDA / 'areas-protegidas-puntos.geojson'
    mapshaper(*comun, '-filter', 'ha >= 500', '-simplify', '1.5%', 'keep-shapes', '-o', 'precision=0.0005', 'format=geojson', str(poligonos))
    mapshaper(*comun, '-filter', 'ha < 500', '-points', 'inner', '-o', 'precision=0.0001', 'format=geojson', str(puntos))
    return sum(len(json.loads(r.read_text(encoding='utf-8'))['features']) for r in (poligonos, puntos))


def capa_paramos(tmp: Path) -> int:
    consulta = {'where': '1=1', 'outFields': 'Nombre,Acto_Admin,Area_Ha', 'outSR': '4326', 'maxAllowableOffset': '0.001', 'geometryPrecision': '4', 'f': 'geojson'}
    crudo = descargar(f'{URL_PARAMOS}?{urllib.parse.urlencode(consulta)}', tmp / 'paramos.geojson')
    datos = json.loads(crudo.read_text(encoding='utf-8'))
    for f in datos['features']:
        f['properties']['Nombre'] = ' '.join(f['properties']['Nombre'].split())
    limpio = tmp / 'paramos-limpio.geojson'
    guardar_json(limpio, datos)
    destino = SALIDA / 'paramos.geojson'
    mapshaper(str(limpio), '-dissolve', 'Nombre', 'sum-fields=Area_Ha', 'copy-fields=Acto_Admin',
              '-rename-fields', 'n=Nombre,ha=Area_Ha,r=Acto_Admin', '-each', 'ha = Math.round(ha)',
              '-simplify', '25%', 'keep-shapes', '-o', 'precision=0.0001', 'format=geojson', str(destino))
    return len(json.loads(destino.read_text(encoding='utf-8'))['features'])


def capa_rios(tmp: Path) -> int:
    datos = json.loads(descargar(URL_RIOS, tmp / 'rios.geojson').read_text(encoding='utf-8'))

    def puntos(g):
        return g['coordinates'] if g['type'] == 'LineString' else [p for linea in g['coordinates'] for p in linea]

    dentro = [f for f in datos['features'] if f['geometry'] and f['properties'].get('name')
              and any(-79.2 < x < -66.8 and -4.3 < y < 12.6 for x, y in puntos(f['geometry']))]
    crudo = tmp / 'rios-colombia.geojson'
    guardar_json(crudo, {'type': 'FeatureCollection', 'features': [
        {'type': 'Feature', 'properties': {'n': f['properties']['name'], 's': f['properties'].get('scalerank')}, 'geometry': f['geometry']} for f in dentro]})
    destino = SALIDA / 'rios.geojson'
    mapshaper(str(crudo), '-clip', 'bbox=-80,-4.5,-66.5,13', '-dissolve', 'n', 'copy-fields=s', '-simplify', '30%',
              '-o', 'precision=0.001', 'format=geojson', str(destino))
    return len(json.loads(destino.read_text(encoding='utf-8'))['features'])


def exportaciones(tmp: Path, url: str) -> dict:
    import openpyxl

    ruta = descargar(url, tmp / 'fnc-exportaciones.xlsx')
    libro = openpyxl.load_workbook(ruta, read_only=True, data_only=True)

    # Destinos: suma mensual del último año completo.
    hoja = libro['7. Destino_Tipo_Vol_Val']
    por_anio: dict[int, dict] = {}
    for fila in hoja.iter_rows(min_row=9, values_only=True, max_col=9):
        anio, _mes, pais, tipo, _s70, sacos, usd = fila[2:9]
        if not isinstance(anio, int) or not pais:
            continue
        anual = por_anio.setdefault(anio, {'paises': {}, 'tipos': {}, 'meses': set()})
        anual['meses'].add(_mes)
        x = anual['paises'].setdefault(pais, [0.0, 0.0])
        x[0] += sacos or 0
        x[1] += usd or 0
        anual['tipos'][tipo] = anual['tipos'].get(tipo, 0) + (sacos or 0)
    anio = max(a for a, v in por_anio.items() if len(v['meses']) == 12)
    anual = por_anio[anio]
    total_sacos = sum(v[0] for v in anual['paises'].values())
    total_usd = sum(v[1] for v in anual['paises'].values())
    destinos = []
    for pais, (sacos, usd) in sorted(anual['paises'].items(), key=lambda kv: -kv[1][0])[:25]:
        if pais not in PAISES:
            print('  aviso: país sin coordenadas, se omite:', pais)
            continue
        en, lat, lng = PAISES[pais]
        destinos.append({'es': pais, 'en': en, 'lat': lat, 'lng': lng, 'sacos': round(sacos), 'usd': round(usd)})

    # Puertos: volumen anual del mismo año.
    hoja = libro['4. Puerto_Volumen']
    filas = list(hoja.iter_rows(values_only=True, max_col=60))
    encabezado = next(f for f in filas if f[2] == 'Puerto de Embarque')
    col = list(encabezado).index(anio)
    puertos = []
    for f in filas:
        if f[2] in PUERTOS and isinstance(f[col], (int, float)) and f[col] > 1000:
            nombre, lat, lng = PUERTOS[f[2]]
            puertos.append({'n': nombre, 'lat': lat, 'lng': lng, 'sacos': round(f[col])})
    puertos.sort(key=lambda p: -p['sacos'])

    return {
        'anio': anio,
        'sacos': round(total_sacos),
        'usd': round(total_usd),
        'paises': len(anual['paises']),
        'tipos': {k: round(v) for k, v in sorted(anual['tipos'].items(), key=lambda kv: -kv[1])},
        'destinos': destinos,
        'puertos': puertos,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--fnc-expo', default=URL_FNC_EXPO, help='URL del Excel de exportaciones de la FNC (cambia cada mes)')
    parser.add_argument('--cache', help='carpeta para reutilizar descargas entre corridas')
    args = parser.parse_args()
    SALIDA.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporal:
        tmp = Path(args.cache) if args.cache else Path(temporal)
        tmp.mkdir(parents=True, exist_ok=True)
        print('Producción de café (EVA)…')
        produccion = eva(tmp)
        resumen = capa_municipios(tmp, produccion)
        print('Áreas protegidas (RUNAP)…')
        n_runap = capa_runap(tmp)
        print('Páramos…')
        n_paramos = capa_paramos(tmp)
        print('Ríos…')
        n_rios = capa_rios(tmp)
        print('Exportaciones (FNC)…')
        expo = exportaciones(tmp, args.fnc_expo)

    departamentos = sorted(
        ({'d': d, 't': round(v['t']), 'h': round(v['h']), 'n': v['n']} for d, v in resumen['departamentos'].items()),
        key=lambda x: -x['t'],
    )
    total_t = sum(d['t'] for d in departamentos)
    areas = [f['properties'] for nombre in ('areas-protegidas.geojson', 'areas-protegidas-puntos.geojson')
             for f in json.loads((SALIDA / nombre).read_text(encoding='utf-8'))['features']]
    paramos = json.loads((SALIDA / 'paramos.geojson').read_text(encoding='utf-8'))['features']
    naturaleza = {
        'areasProtegidas': len(areas),
        'reservasCiviles': sum(1 for a in areas if a['c'] == 'Reserva Natural de la Sociedad Civil'),
        'parquesNacionales': sum(1 for a in areas if a['c'] == 'Parque Nacional Natural'),
        'paramos': len(paramos),
        'paramosHa': round(sum(f['properties']['ha'] or 0 for f in paramos)),
    }
    guardar_json(SALIDA / 'cafe-datos.json', {
        'naturaleza': naturaleza,
        'produccion': {'anio': int(ANIO_EVA), 'toneladas': total_t, 'hectareas': sum(d['h'] for d in departamentos),
                       'municipios': resumen['municipios'], 'departamentos': departamentos},
        'exportaciones': expo,
    })
    guardar_json(SALIDA / 'fuentes.json', [
        {'capa': 'Producción de café por municipio', 'fuente': f'UPRA / MinAgricultura — Evaluaciones Agropecuarias Municipales (EVA) {ANIO_EVA}', 'url': 'https://www.datos.gov.co/d/uejq-wxrr'},
        {'capa': 'Áreas protegidas', 'fuente': 'Parques Nacionales Naturales de Colombia — RUNAP', 'url': 'https://runap.parquesnacionales.gov.co/'},
        {'capa': 'Páramos', 'fuente': 'MinAmbiente / Instituto Humboldt — páramos delimitados', 'url': 'https://www.minambiente.gov.co/'},
        {'capa': 'Ríos', 'fuente': 'Natural Earth 1:10m (dominio público)', 'url': 'https://www.naturalearthdata.com/'},
        {'capa': 'Municipios', 'fuente': 'DANE MGN 2025 · mapas-colombia (CC BY 4.0)', 'url': 'https://github.com/ytolosa/mapas-colombia'},
        {'capa': 'Exportaciones', 'fuente': f"Federación Nacional de Cafeteros — exportaciones {expo['anio']}", 'url': 'https://federaciondecafeteros.org/wp/estadisticas-cafeteras/'},
        {'capa': 'Denominaciones de origen', 'fuente': 'Café de Colombia (FNC) y resoluciones de la SIC', 'url': 'https://cafedecolombia.com/denominacion-de-origen-regional/'},
        {'capa': 'Paisaje Cultural Cafetero', 'fuente': 'UNESCO, Patrimonio Mundial 2011 (municipios del área principal)', 'url': 'https://whc.unesco.org/es/list/1121'},
    ])
    print(f"Listo: {resumen['municipios']} municipios cafeteros, {n_runap} áreas protegidas, {n_paramos} páramos, {n_rios} ríos, "
          f"{len(expo['destinos'])} destinos y {len(expo['puertos'])} puertos ({expo['anio']}).")
    for archivo in sorted(SALIDA.iterdir()):
        print(f'  {archivo.name}: {archivo.stat().st_size / 1024:.0f} KB')


if __name__ == '__main__':
    sys.exit(main())
