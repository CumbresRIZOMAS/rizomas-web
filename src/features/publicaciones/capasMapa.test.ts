import { describe, expect, it } from 'vitest'
import { centroPoligono, datosCuriosos, dopDeDepartamento, granCirculo, type CafeDatos } from './capasMapa'

const DATOS: CafeDatos = {
  naturaleza: { areasProtegidas: 1949, reservasCiviles: 1489, parquesNacionales: 44, paramos: 36, paramosHa: 2743064 },
  produccion: {
    anio: 2025, toneladas: 820824, hectareas: 836009, municipios: 640,
    departamentos: [{ d: 'HUILA', t: 162599, h: 150127, n: 35 }, { d: 'ANTIOQUIA', t: 130905, h: 111463, n: 95 }],
  },
  exportaciones: {
    anio: 2025, sacos: 13138884, usd: 5079848347, paises: 108, tipos: { 'Café Verde': 12220205 },
    destinos: [{ es: 'EE.UU.', en: 'United States', lat: 39.5, lng: -98.35, sacos: 5277074, usd: 2002686426 }],
    puertos: [{ n: 'Buenaventura', lat: 3.88, lng: -77.03, sacos: 8183502 }],
  },
}

describe('capasMapa', () => {
  it('arma los datos curiosos a partir de las fuentes, en los dos idiomas', () => {
    const es = datosCuriosos(DATOS, 'es', { municipioTop: { nombre: 'Pitalito', centro: [-76.1, 1.8] }, fincasEnTop: 40 })
    expect(es.map((d) => d.id)).toContain('municipio-top')
    expect(es.find((d) => d.id === 'municipio-top')?.texto).toBe('Pitalito es el municipio que más café produce en Colombia. Allí están 40 de las fincas de este mapa.')
    expect(es.find((d) => d.id === 'departamento-top')?.texto).toMatch(/^Huila aporta el 20 %/)
    expect(es.find((d) => d.id === 'puerto')?.texto).toBe('62 % del café exportado sale por Buenaventura, en el Pacífico.')
    expect(es.find((d) => d.id === 'exportaciones')?.accion.vista).toBe('mundo')
    const en = datosCuriosos(DATOS, 'en', { municipioTop: null })
    expect(en.map((d) => d.id)).not.toContain('municipio-top')
    expect(en.find((d) => d.id === 'exportaciones')?.texto).toMatch(/The United States bought 40%/)
  })

  it('traza arcos de gran círculo que empiezan y terminan en los puntos dados', () => {
    const arco = granCirculo([-75.6, 4.8], [139.7, 35.7], 32)
    expect(arco).toHaveLength(33)
    expect(arco[0][0]).toBeCloseTo(-75.6)
    expect(arco[32][1]).toBeCloseTo(35.7)
  })

  it('ubica la etiqueta de un polígono dentro de su anillo más grande', () => {
    const [x, y] = centroPoligono({ type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]], [[[10, 10], [14, 10], [14, 14], [10, 14], [10, 10]]]] })
    expect(x).toBeCloseTo(12)
    expect(y).toBeCloseTo(12)
  })

  it('reconoce los departamentos con denominación de origen', () => {
    expect(dopDeDepartamento('Nariño')).toBe('narino')
    expect(dopDeDepartamento('QUINDÍO')).toBeNull()
  })
})
