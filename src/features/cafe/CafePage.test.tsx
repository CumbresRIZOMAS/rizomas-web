import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeAuth, mockApi, renderWithAuth } from '../../test/utils'
import { CafePage } from './CafePage'

const finca = { id: 'finca-1', name: 'La Esperanza', farmType: 'EN_TRANSICION', createdAt: '2026-01-01T00:00:00.000Z' }
const proceso = {
  id: 'cp-1',
  farmId: 'finca-1',
  harvestId: 'h1',
  currentStage: 'Lavado',
  startedAt: '2026-06-16T00:00:00.000Z',
  finishedAt: null,
  notes: 'Humedad 18 %',
  harvest: { id: 'h1', quantity: '680', unit: 'kg' },
  products: [{ id: 'pf-1', finalizedAt: '2026-07-01T00:00:00.000Z', destination: 'Tostado 340 g', certifications: [] }],
}

function api(extra: Record<string, unknown> = {}) {
  return mockApi({
    'GET /farms': [finca],
    'GET /coffee-processes/farms/finca-1': [proceso],
    'GET /farms/finca-1/labors': [],
    ...extra,
  })
}

describe('CafePage', () => {
  it('avanza a la siguiente etapa del proceso', async () => {
    const calls = api({ 'PATCH /coffee-processes/cp-1': { ...proceso, currentStage: 'Secado' } })
    renderWithAuth(<CafePage />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Pasar a secado/ }))
    expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ url: '/coffee-processes/cp-1', body: { currentStage: 'Secado' } })
  })

  it('certifica un producto final', async () => {
    const calls = api({ 'POST /coffee-processes/products/pf-1/certifications': { id: 'c1' } })
    renderWithAuth(<CafePage />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Certificación/ }))
    await user.type(screen.getByLabelText(/Certificadora/), 'Rainforest Alliance')
    await user.selectOptions(screen.getByLabelText(/Estado/), 'VIGENTE')
    await user.click(screen.getByRole('button', { name: 'Guardar certificación' }))
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ certifier: 'Rainforest Alliance', status: 'VIGENTE' })
  })

  it('un agricultor no puede certificar', async () => {
    api()
    renderWithAuth(<CafePage />, { auth: fakeAuth('AGRICULTOR') })
    expect(await screen.findByText('Tostado 340 g')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Certificación/ })).not.toBeInTheDocument()
  })
})
