import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockApi, renderWithAuth } from '../../test/utils'
import { SuelosPage } from './SuelosPage'

const finca = { id: 'finca-1', name: 'La Esperanza', farmType: 'EN_TRANSICION', createdAt: '2026-09-01T00:00:00.000Z' }
const lote = { id: 'lote-1', farmId: 'finca-1', name: 'Lote Alto', identifier: null, areaHa: '5.20', createdAt: '2026-09-01T00:00:00.000Z', crops: [] }

const analisis = {
  id: 'a1',
  farmId: 'finca-1',
  lotId: 'lote-1',
  date: '2026-06-08T00:00:00.000Z',
  laboratory: 'Agrilab',
  observations: null,
  lot: { id: 'lote-1', name: 'Lote Alto' },
  diagnostics: [
    {
      id: 'd1',
      parameter: 'Nitrógeno',
      value: '0.1800',
      unit: '%',
      referenceMin: '0.2500',
      referenceMax: '0.4000',
      status: 'BAJO',
      recommendations: [{ id: 'r1', diagnosisId: 'd1', type: 'PRACTICA', description: 'Aplicar compost enriquecido', automatic: true, createdAt: '2026-06-08T00:00:00.000Z' }],
    },
    { id: 'd2', parameter: 'pH', value: '5.4000', unit: null, referenceMin: null, referenceMax: null, status: 'SIN_REFERENCIA', recommendations: [] },
  ],
}

function api(extra: Record<string, unknown> = {}) {
  return mockApi({
    'GET /farms': [finca],
    'GET /farms/finca-1': { ...finca, lots: [lote], labors: [] },
    'GET /farms/finca-1/soil-analyses': [analisis],
    ...extra,
  })
}

describe('SuelosPage', () => {
  it('muestra el diagnóstico por parámetro y sus recomendaciones', async () => {
    api()
    renderWithAuth(<SuelosPage />)

    expect(await screen.findByText('0,25 – 0,4 %')).toBeInTheDocument()
    expect(screen.getByText('Nitrógeno', { selector: '.soil-row strong' })).toBeInTheDocument()
    expect(screen.getByText('Bajo')).toBeInTheDocument()
    expect(screen.getByText('Sin rango de referencia')).toBeInTheDocument()
    expect(screen.getByText('Aplicar compost enriquecido')).toBeInTheDocument()
  })

  it('registra un análisis solo con los parámetros que tienen valor', async () => {
    const calls = api({ 'POST /soil-analyses': { ...analisis, id: 'a2' } })
    renderWithAuth(<SuelosPage />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Registrar análisis/ }))
    await user.type(screen.getByLabelText('Laboratorio'), 'Agrilab')
    await user.type(screen.getByLabelText('Valor de pH'), '5,4')
    await user.type(screen.getByLabelText('Valor de Nitrógeno'), '0,18')
    await user.click(screen.getByRole('button', { name: /Guardar análisis/ }))

    const post = calls.find((c) => c.method === 'POST')!
    expect(post.body).toMatchObject({
      farmId: 'finca-1',
      lotId: 'lote-1',
      laboratory: 'Agrilab',
      parameters: [
        { name: 'pH', value: 5.4 },
        { name: 'Nitrógeno', value: 0.18, unit: '%' },
      ],
    })
  })
})
