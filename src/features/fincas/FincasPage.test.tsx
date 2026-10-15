import { screen, within } from '@testing-library/react'
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
  climate: 'Templado',
  farmType: 'REGENERATIVA',
  createdAt: '2026-09-01T00:00:00.000Z',
  lots: [{ id: 'l1' }, { id: 'l2' }],
  owner: { id: 'u1', name: 'Ana Lucía Díaz' },
}

const otra = { ...finca, id: 'finca-2', name: 'Las Brisas', municipality: 'Planadas', region: 'Tolima', farmType: 'CONVENCIONAL', owner: null }

describe('FincasPage', () => {
  it('lista las fincas con su resumen', async () => {
    mockApi({ 'GET /farms': [finca] })
    renderWithAuth(<FincasPage />)

    const tabla = within(await screen.findByRole('table'))
    expect(tabla.getByRole('link', { name: 'El Porvenir' })).toHaveAttribute('href', '/fincas/finca-1')
    expect(tabla.getByText('Pitalito, Huila')).toBeInTheDocument()
    expect(tabla.getByText('12,5 ha')).toBeInTheDocument()
    expect(tabla.getByText('Regenerativa')).toBeInTheDocument()
    expect(tabla.getByText('Ana Lucía Díaz')).toBeInTheDocument()
    expect(screen.getByText('Mostrando 1 de 1 finca')).toBeInTheDocument()
  })

  it('filtra por texto y por tipo de finca', async () => {
    mockApi({ 'GET /farms': [finca, otra] })
    renderWithAuth(<FincasPage />)
    const user = userEvent.setup()

    await screen.findByRole('table')
    await user.type(screen.getByLabelText('Buscar finca'), 'planadas')
    expect(screen.queryByRole('link', { name: 'El Porvenir' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Las Brisas' })).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Buscar finca'))
    await user.selectOptions(screen.getByLabelText('Tipo de finca'), 'REGENERATIVA')
    expect(screen.getByRole('link', { name: 'El Porvenir' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Las Brisas' })).not.toBeInTheDocument()
  })

  it('un agricultor no ve el botón de registrar finca', async () => {
    mockApi({ 'GET /farms': [] })
    renderWithAuth(<FincasPage />, { auth: fakeAuth('AGRICULTOR') })

    expect(await screen.findByText('Todavía no hay fincas')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Registrar finca/ })).not.toBeInTheDocument()
  })

  it('crea una finca y navega a su detalle', async () => {
    const calls = mockApi({ 'GET /farms': [], 'POST /farms': { ...finca, id: 'nueva' } })
    renderWithAuth(<FincasPage />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Registrar finca/ }))
    await user.type(screen.getByLabelText(/^Nombre/), 'La Primavera')
    await user.type(screen.getByLabelText(/Área/), '3,5')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ name: 'La Primavera', areaHa: 3.5, farmType: 'EN_TRANSICION' })
    expect(await screen.findByText('Otra página')).toBeInTheDocument()
  })
})
