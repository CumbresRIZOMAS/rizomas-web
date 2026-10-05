import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeAuth, mockApi, renderWithAuth } from '../../test/utils'
import { FincasPage } from './FincasPage'

const finca = {
  id: 'finca-1',
  name: 'El Porvenir',
  identifier: null,
  municipality: 'Pitalito',
  region: 'Huila',
  areaHa: '12.50',
  climate: null,
  farmType: 'REGENERATIVA',
  createdAt: '2026-09-01T00:00:00.000Z',
  lots: [{ id: 'l1' }, { id: 'l2' }],
}

describe('FincasPage', () => {
  it('lista las fincas con su resumen', async () => {
    mockApi({ 'GET /farms': [finca] })
    renderWithAuth(<FincasPage />)

    expect(await screen.findByRole('heading', { name: 'El Porvenir' })).toBeInTheDocument()
    expect(screen.getByText('Pitalito, Huila')).toBeInTheDocument()
    expect(screen.getByText('2 lotes')).toBeInTheDocument()
    expect(screen.getByText('12,5 ha')).toBeInTheDocument()
    expect(screen.getByText('Regenerativa')).toBeInTheDocument()
  })

  it('un agricultor no ve el botón de crear finca', async () => {
    mockApi({ 'GET /farms': [] })
    renderWithAuth(<FincasPage />, { auth: fakeAuth('AGRICULTOR') })

    expect(await screen.findByText('Todavía no hay fincas')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nueva finca/ })).not.toBeInTheDocument()
  })

  it('crea una finca y navega a su detalle', async () => {
    const calls = mockApi({ 'GET /farms': [], 'POST /farms': { ...finca, id: 'nueva' } })
    renderWithAuth(<FincasPage />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Nueva finca/ }))
    await user.type(screen.getByLabelText(/^Nombre/), 'La Primavera')
    await user.type(screen.getByLabelText(/Área/), '3,5')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ name: 'La Primavera', areaHa: 3.5, farmType: 'EN_TRANSICION' })
    expect(await screen.findByText('Otra página')).toBeInTheDocument()
  })
})
