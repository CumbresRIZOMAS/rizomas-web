import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeAuth, mockApi, renderWithAuth } from '../../test/utils'
import { LaborWizard } from './LaborWizard'

const finca = {
  id: 'finca-1',
  name: 'La Esperanza',
  identifier: null,
  municipality: 'Pitalito',
  region: 'Huila',
  areaHa: '12.50',
  climate: null,
  farmType: 'EN_TRANSICION',
  createdAt: '2026-09-01T00:00:00.000Z',
}

const lote = {
  id: 'lote-1',
  farmId: 'finca-1',
  name: 'Lote Alto',
  identifier: null,
  areaHa: '5.20',
  createdAt: '2026-09-01T00:00:00.000Z',
  crops: [
    { id: 'cultivo-1', lotId: 'lote-1', species: 'Café', variety: 'Castillo', plantingDate: null, status: null, createdAt: '2026-09-01T00:00:00.000Z' },
  ],
}

function api(extra: Record<string, unknown>, lots = [lote]) {
  return mockApi({
    'GET /farms': [finca],
    'GET /farms/finca-1': { ...finca, lots, labors: [] },
    ...extra,
  })
}

async function avanzar(user: ReturnType<typeof userEvent.setup>, tipo: RegExp) {
  await user.click(await screen.findByRole('radio', { name: tipo }))
  await user.click(screen.getByRole('button', { name: /Continuar/ }))
}

describe('LaborWizard', () => {
  it('un manejo agronómico sin cultivo se registra sobre el lote (regla xor)', async () => {
    const calls = api({ 'POST /agronomic-management': { id: 'labor-1', name: 'Limpieza antes de sembrar' } })
    renderWithAuth(<LaborWizard />)
    const user = userEvent.setup()

    await avanzar(user, /Manejo agronómico/)
    await user.click(screen.getByRole('button', { name: /Continuar/ }))
    await user.selectOptions(screen.getByLabelText(/Actividad/), 'LIMPIEZA')
    await user.type(screen.getByLabelText(/Descripción/), 'Limpieza antes de sembrar')
    await user.type(screen.getByLabelText(/Duración/), '1,5')
    await user.click(screen.getByRole('button', { name: /Guardar labor/ }))

    expect(await screen.findByText('Labor guardada correctamente')).toBeInTheDocument()
    const post = calls.find((c) => c.method === 'POST')!
    expect(post.body).toMatchObject({ farmId: 'finca-1', lotId: 'lote-1', type: 'MANEJO_AGRONOMICO', managementType: 'LIMPIEZA', durationMin: 90 })
    expect(post.body).not.toHaveProperty('cropId')
  })

  it('una cosecha exige cultivo y cantidad, y no manda el lote', async () => {
    const calls = api({ 'POST /harvests': { id: 'labor-2', name: 'Primera pasada' } })
    renderWithAuth(<LaborWizard />)
    const user = userEvent.setup()

    await avanzar(user, /Cosecha/)
    expect(screen.getByRole('button', { name: /Continuar/ })).toBeDisabled()
    await user.selectOptions(screen.getByLabelText(/Cultivo/), 'cultivo-1')
    await user.click(screen.getByRole('button', { name: /Continuar/ }))

    await user.type(screen.getByLabelText(/Descripción/), 'Primera pasada')
    const guardar = screen.getByRole('button', { name: /Guardar labor/ })
    expect(guardar).toBeDisabled()
    await user.type(screen.getByLabelText(/Cantidad/), '680')
    await user.click(guardar)

    const post = calls.find((c) => c.method === 'POST')!
    expect(post).toMatchObject({ url: '/harvests' })
    expect(post.body).toMatchObject({ cropId: 'cultivo-1', type: 'COSECHA', quantity: 680, unit: 'kg' })
    expect(post.body).not.toHaveProperty('lotId')
  })

  it('muestra el error del backend y no da la labor por guardada', async () => {
    api({ 'POST /labors': 400 })
    renderWithAuth(<LaborWizard />)
    const user = userEvent.setup()

    await avanzar(user, /Siembra/)
    await user.click(screen.getByRole('button', { name: /Continuar/ }))
    await user.type(screen.getByLabelText(/Descripción/), 'Siembra de Castillo')
    await user.click(screen.getByRole('button', { name: /Guardar labor/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Error simulado')
    expect(screen.queryByText('Labor guardada correctamente')).not.toBeInTheDocument()
  })

  it('sin lotes explica que primero hay que crear uno', async () => {
    api({}, [])
    renderWithAuth(<LaborWizard />)
    const user = userEvent.setup()

    await avanzar(user, /Manejo agronómico/)
    expect(screen.getByText(/Primero agrega un lote/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continuar/ })).toBeDisabled()
  })

  it('un técnico no puede elegir compra ni venta', async () => {
    api({})
    renderWithAuth(<LaborWizard />, { auth: fakeAuth('TECNICO') })
    expect(await screen.findByRole('radio', { name: /Compra/ })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /Venta/ })).toBeDisabled()
  })
})
