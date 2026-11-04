import { describe, expect, it } from 'vitest'
import { escribirMetodo, leerMetodo, rutaDe, siguienteEtapa, TIPOS_PROCESO } from './guiaBeneficio'

const evento = (stage: string, method: string | null = null) => ({ stage, method, recordedAt: `2026-06-1${['Cosecha', 'Despulpado', 'Fermentación', 'Lavado', 'Secado', 'Trilla'].indexOf(stage)}T10:00:00.000Z` })

describe('guiaBeneficio', () => {
  it('escribe y lee el tipo de proceso en el método, sin confundir textos libres', () => {
    const honey = TIPOS_PROCESO.find((t) => t.id === 'honey')!
    expect(escribirMetodo(honey, 'Negro', 'Camas africanas')).toBe('Honey negro · Camas africanas')
    expect(leerMetodo('Honey negro · Camas africanas')).toMatchObject({ tipo: { id: 'honey' }, variante: 'Negro', tecnica: 'Camas africanas' })
    expect(leerMetodo('Lavado de recirculación')).toEqual({ tipo: null, variante: null, tecnica: 'Lavado de recirculación' })
  })

  it('sigue la ruta del tipo y toma en cuenta la etapa actual sin mediciones', () => {
    const natural = { events: [evento('Cosecha', 'Natural')] as never, finishedAt: null, currentStage: 'Cosecha' }
    expect(rutaDe(natural)).toEqual(['Cosecha', 'Secado', 'Trilla'])
    expect(siguienteEtapa(natural)).toBe('Secado')
    expect(siguienteEtapa({ events: [], finishedAt: null, currentStage: 'Lavado' })).toBe('Secado')
    expect(siguienteEtapa({ events: [], finishedAt: '2026-07-01', currentStage: 'Trilla' })).toBeNull()
  })
})
