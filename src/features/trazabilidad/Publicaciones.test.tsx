import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockApi, renderWithAuth } from '../../test/utils'
import { Publicaciones } from './Publicaciones'

const finca = { id: 'finca-1', name: 'La Esperanza', region: 'Huila', farmType: 'EN_TRANSICION', createdAt: '' }
const traza = {
  ...finca,
  lots: [],
  coffeeProcesses: [],
  labors: [
    { id: 'l1', farmId: 'finca-1', lotId: null, cropId: 'c1', type: 'COSECHA', name: 'Recolección', startDate: '2026-06-16T00:00:00.000Z', endDate: null, durationMin: null, observations: null, harvest: { id: 'h1', quantity: '680', unit: 'kg' } },
  ],
}

describe('Publicaciones', () => {
  it('crea un borrador con la región y la cantidad de la cosecha', async () => {
    const calls = mockApi({ 'GET /farms': [], 'GET /publications/farms/finca-1': [], 'POST /publications': { id: 'p1' } })
    renderWithAuth(<Publicaciones farm={finca as never} traza={traza as never} />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Nueva publicación/ }))
    await user.type(screen.getByLabelText(/Título/), 'Castillo lavado')
    await user.click(screen.getByRole('button', { name: /Guardar borrador/ }))

    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ farmId: 'finca-1', harvestId: 'h1', title: 'Castillo lavado', region: 'Huila', quantity: 680, unit: 'kg', publicLocation: null })
  })

  it('publica y retira', async () => {
    const borrador = { id: 'p1', title: 'Castillo lavado', region: 'Huila', quantity: '680', unit: 'kg', active: false, publishedAt: null, harvest: null }
    const calls = mockApi({ 'GET /farms': [], 'GET /publications/farms/finca-1': [borrador], 'PATCH /publications/p1/status': { ...borrador, active: true } })
    renderWithAuth(<Publicaciones farm={finca as never} traza={traza as never} />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Publicar' }))
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ active: true })
  })
})
