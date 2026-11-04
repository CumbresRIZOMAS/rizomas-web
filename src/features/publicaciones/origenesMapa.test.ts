import { describe, expect, it } from 'vitest'
import type { Publication } from '../../shared/api/types'
import { etapaVisible, nombreVisible, posicionarOrigenes } from './origenesMapa'

const origen = (id: string, extra: Partial<Publication> = {}): Publication => ({
  id, title: id, farmName: id, municipality: 'PITALITO', region: 'HUILA',
  quantity: null, unit: null, publishedAt: null, evidences: [], isPublished: false, ...extra,
})

describe('origenesMapa', () => {
  it('vuelve legibles los nombres escritos en mayúsculas', () => {
    expect(nombreVisible('BRISAS DEL MAGDALENA')).toBe('Brisas del Magdalena')
    expect(nombreVisible('QUINDÍO')).toBe('Quindío')
    expect(nombreVisible('Finca La Esperanza')).toBe('Finca La Esperanza')
  })

  it('reparte las fincas cerca de su municipio sin repetir posiciones y de forma estable', () => {
    const puntos = posicionarOrigenes([origen('a'), origen('b'), origen('c')])
    expect(puntos).toHaveLength(3)
    for (const p of puntos) {
      expect(p.aproximado).toBe(true)
      expect(Math.abs(p.lat - 1.83)).toBeLessThan(0.12)
      expect(Math.abs(p.lng + 76.12)).toBeLessThan(0.12)
    }
    expect(new Set(puntos.map((p) => `${p.lat},${p.lng}`)).size).toBe(3)
    expect(posicionarOrigenes([origen('c'), origen('a'), origen('b')]).find((p) => p.origen.id === 'a')).toEqual(puntos.find((p) => p.origen.id === 'a'))
  })

  it('usa la ubicación pública cuando la finca la compartió', () => {
    const [p] = posicionarOrigenes([origen('x', { publicLocation: { latitude: 2.5, longitude: -75.5 } })])
    expect(p).toMatchObject({ lat: 2.5, lng: -75.5, aproximado: false })
  })

  it('omite fincas sin municipio ni departamento reconocible', () => {
    expect(posicionarOrigenes([origen('z', { municipality: null, region: 'ATLANTIS' })])).toHaveLength(0)
  })

  it('traduce las etapas de beneficio', () => {
    expect(etapaVisible('SECADO', 'es')).toBe('Secado')
    expect(etapaVisible('SECADO', 'en')).toBe('Drying')
    expect(etapaVisible('DESPULPADO', 'en')).toBe('Pulping')
    expect(etapaVisible('TOSTIÓN', 'es')).toBe('Tostión')
  })
})
