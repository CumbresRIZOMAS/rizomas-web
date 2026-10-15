import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { mockApi, renderWithAuth } from '../../test/utils'
import { MovimientoForm } from './ComercialPanel'

describe('MovimientoForm', () => {
  it('una compra envía el proveedor por nombre', async () => {
    const calls = mockApi({
      'GET /farms': [],
      'GET /commercial/suppliers': [{ id: 's1', name: 'Cooperativa del Sur', inputType: null }],
      'POST /commercial/purchases': { id: 'c1' },
    })
    renderWithAuth(<MovimientoForm farmId="f1" onSaved={vi.fn()} onCancel={vi.fn()} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/Insumo o servicio/), 'Cal dolomita')
    await user.type(screen.getByLabelText(/Cantidad/), '2')
    await user.type(screen.getByLabelText(/Proveedor/), 'Cooperativa del Sur')
    await user.click(screen.getByRole('button', { name: /Guardar movimiento/ }))

    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ farmId: 'f1', itemName: 'Cal dolomita', quantity: 2, supplierName: 'Cooperativa del Sur' })
  })
})
