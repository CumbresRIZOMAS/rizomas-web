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

  it('guía la siguiente etapa según el tipo de proceso y guarda el tipo en el método', async () => {
    const honey = {
      ...proceso,
      currentStage: 'Despulpado',
      products: [],
      events: [
        { id: 'e1', stage: 'Cosecha', recordedAt: '2026-06-16T10:00:00.000Z', inputKg: null, outputKg: '500', waterLiters: null, wastewaterLiters: null, compostReuse: false, wastewaterDestination: null, durationHours: null, method: 'Honey rojo', brix: null, ph: null, moisturePercent: null, scaScore: null, notes: null },
        { id: 'e2', stage: 'Despulpado', recordedAt: '2026-06-16T15:00:00.000Z', inputKg: '500', outputKg: '300', waterLiters: null, wastewaterLiters: null, compostReuse: false, wastewaterDestination: null, durationHours: null, method: 'Honey rojo', brix: null, ph: null, moisturePercent: null, scaScore: null, notes: null },
      ],
    }
    const calls = api({ 'GET /coffee-processes/farms/finca-1': [honey], 'POST /coffee-processes/cp-1/events': { ...honey } })
    renderWithAuth(<CafePage />)
    const user = userEvent.setup()

    // Honey no fermenta ni lava: después del despulpado sigue el secado.
    await user.click(await screen.findByRole('button', { name: /Registrar secado/ }))
    expect(screen.getByText(/capas delgadas/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Marquesina' }))
    await user.click(screen.getByRole('button', { name: '12' }))
    await user.type(screen.getByLabelText('Humedad'), '11')
    expect(screen.getByText(/punto ideal/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Guardar secado/ }))

    const post = calls.find((c) => c.method === 'POST')
    expect(post?.url).toBe('/coffee-processes/cp-1/events')
    expect(post?.body).toMatchObject({ stage: 'Secado', method: 'Honey rojo · Marquesina', durationHours: 288, moisturePercent: 11 })
  })

  it('crea un proceso nuevo con su tipo y su primera etapa', async () => {
    const calls = api({
      'GET /coffee-processes/farms/finca-1': [],
      'GET /farms/finca-1/lots': [{ id: 'lote-1', name: 'El Mirador' }],
      'POST /coffee-processes': { ...proceso, id: 'cp-9', events: [] },
      'POST /coffee-processes/cp-9/events': {},
    })
    renderWithAuth(<CafePage />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Iniciar proceso/ }))
    await user.click(await screen.findByRole('button', { name: /El Mirador/ }))
    await user.click(screen.getByRole('button', { name: /Continuar/ }))
    await user.click(screen.getAllByRole('button', { name: /^🍒 Natural/ })[0])
    await user.click(screen.getByRole('button', { name: /Continuar/ }))
    await user.type(screen.getByLabelText('Cereza recolectada'), '420')
    await user.click(screen.getByRole('button', { name: /Crear proceso y guardar cosecha/ }))

    const posts = calls.filter((c) => c.method === 'POST')
    expect(posts[0]).toMatchObject({ url: '/coffee-processes', body: { farmId: 'finca-1', lotId: 'lote-1', currentStage: 'Cosecha' } })
    expect(posts[1]).toMatchObject({ url: '/coffee-processes/cp-9/events', body: { stage: 'Cosecha', method: 'Natural', outputKg: 420 } })
  })

  it('abre directo el formulario de la etapa cuando llega desde una sugerencia', async () => {
    api()
    renderWithAuth(<CafePage />, { route: '/?proceso=cp-1&etapa=Secado' })
    expect(await screen.findByRole('button', { name: /Guardar secado/ })).toBeInTheDocument()
    expect(screen.getByText(/10–12 % de humedad/)).toBeInTheDocument()
  })
})
