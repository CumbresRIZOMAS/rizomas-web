import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fakeAuth, mockApi, renderWithAuth } from '../../test/utils'
import { RangosPage } from './RangosPage'

const ph = {
  id: 'r1',
  parameter: 'pH',
  crop: 'Café arábica',
  unit: null,
  min: '5.8000',
  max: '6.5000',
  source: 'Laboratorio',
  notes: null,
  updatedAt: '2026-10-05T00:00:00.000Z',
}

describe('RangosPage', () => {
  it('avisa cuando el catálogo está vacío', async () => {
    mockApi({ 'GET /soil-reference-ranges': [] })
    renderWithAuth(<RangosPage />)
    expect(await screen.findByText(/El catálogo está vacío/)).toBeInTheDocument()
  })

  it('lista los rangos con el cultivo y la fuente', async () => {
    mockApi({ 'GET /soil-reference-ranges': [ph] })
    renderWithAuth(<RangosPage />)
    expect(await screen.findByText('pH')).toBeInTheDocument()
    expect(screen.getByText('Café arábica')).toBeInTheDocument()
    expect(screen.getByText('5,8')).toBeInTheDocument()
  })

  it('no deja guardar sin límites o con el mínimo mayor que el máximo', async () => {
    const calls = mockApi({ 'GET /soil-reference-ranges': [], 'POST /soil-reference-ranges': { ...ph, id: 'r2' } })
    renderWithAuth(<RangosPage />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Nuevo rango/ }))
    await user.type(screen.getByLabelText(/Parámetro/), 'Fósforo')
    const guardar = screen.getByRole('button', { name: 'Guardar rango' })
    expect(guardar).toBeDisabled()

    await user.type(screen.getByLabelText('Mínimo'), '40')
    await user.type(screen.getByLabelText('Máximo'), '20')
    expect(screen.getByText(/no puede ser mayor/)).toBeInTheDocument()
    expect(guardar).toBeDisabled()

    await user.clear(screen.getByLabelText('Máximo'))
    await user.type(screen.getByLabelText('Máximo'), '60')
    await user.click(guardar)
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ parameter: 'Fósforo', crop: '', min: 40, max: 60 })
  })

  it('pide confirmación antes de eliminar', async () => {
    const calls = mockApi({ 'GET /soil-reference-ranges': [ph], 'DELETE /soil-reference-ranges/r1': { id: 'r1' } })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderWithAuth(<RangosPage />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Eliminar' }))
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true)
  })

  it('un administrador de finca solo consulta', async () => {
    mockApi({ 'GET /soil-reference-ranges': [ph] })
    renderWithAuth(<RangosPage />, { auth: fakeAuth('ADMIN_FINCA') })
    expect(await screen.findByText('pH')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nuevo rango/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument()
  })
})
