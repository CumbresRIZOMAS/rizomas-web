import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { LotWithCrops } from '../../shared/api/types'
import { mockApi, renderWithAuth } from '../../test/utils'
import { LaborForm } from './LaborForm'

const lots: LotWithCrops[] = [
  {
    id: 'lote-1',
    farmId: 'finca-1',
    name: 'La Esperanza',
    identifier: null,
    areaHa: '1.20',
    createdAt: '2026-09-01T00:00:00.000Z',
    crops: [
      {
        id: 'cultivo-1',
        lotId: 'lote-1',
        species: 'Café arábica',
        variety: 'Castillo',
        plantingDate: null,
        status: null,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ],
  },
]

function renderForm(onSaved = vi.fn()) {
  renderWithAuth(<LaborForm farmId="finca-1" lots={lots} onSaved={onSaved} onCancel={vi.fn()} />)
  return onSaved
}

describe('LaborForm', () => {
  it('una labor general se registra sobre el lote, sin cultivo (regla xor)', async () => {
    const calls = mockApi({ 'POST /labors': { id: 'labor-1' } })
    const onSaved = renderForm()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/Descripción/), 'Limpieza antes de sembrar')
    await user.click(screen.getByRole('button', { name: 'Registrar labor' }))

    expect(onSaved).toHaveBeenCalled()
    expect(calls[0].body).toMatchObject({ farmId: 'finca-1', lotId: 'lote-1', type: 'OTRO', name: 'Limpieza antes de sembrar' })
    expect(calls[0].body).not.toHaveProperty('cropId')
  })

  it('una cosecha siempre va sobre un cultivo y exige cantidad', async () => {
    const calls = mockApi({ 'POST /harvests': { id: 'labor-2' } })
    renderForm()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Cosecha' }))
    expect(screen.getByRole('button', { name: 'Un lote' })).toBeDisabled()

    await user.type(screen.getByLabelText(/Descripción/), 'Primera pasada')
    const guardar = screen.getByRole('button', { name: 'Registrar labor' })
    expect(guardar).toBeDisabled()

    await user.type(screen.getByLabelText(/Cantidad/), '120')
    await user.click(guardar)

    expect(calls[0]).toMatchObject({ url: '/harvests', method: 'POST' })
    expect(calls[0].body).toMatchObject({ cropId: 'cultivo-1', type: 'COSECHA', quantity: 120, unit: 'kg' })
    expect(calls[0].body).not.toHaveProperty('lotId')
  })

  it('el manejo agronómico va a su endpoint con el tipo de manejo', async () => {
    const calls = mockApi({ 'POST /agronomic-management': { id: 'labor-3' } })
    renderForm()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Manejo agronómico' }))
    await user.selectOptions(screen.getByLabelText('Tipo de manejo'), 'PODA')
    await user.type(screen.getByLabelText(/Descripción/), 'Poda de formación')
    await user.click(screen.getByRole('button', { name: 'Registrar labor' }))

    expect(calls[0].body).toMatchObject({ type: 'MANEJO_AGRONOMICO', managementType: 'PODA', lotId: 'lote-1' })
  })

  it('muestra el error del backend y no cierra el formulario', async () => {
    mockApi({ 'POST /labors': 400 })
    const onSaved = renderForm()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/Descripción/), 'Algo')
    await user.click(screen.getByRole('button', { name: 'Registrar labor' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Error simulado')
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('sin lotes explica que primero hay que crear uno', () => {
    renderWithAuth(<LaborForm farmId="finca-1" lots={[]} onSaved={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(/Primero agrega un lote/)).toBeInTheDocument()
  })
})
