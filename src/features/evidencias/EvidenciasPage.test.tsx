import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockApi, renderWithAuth } from '../../test/utils'
import { EvidenciasPage } from './EvidenciasPage'

const evidencia = {
  id: 'e1',
  farmId: 'finca-1',
  lotId: 'lote-1',
  laborId: 'labor-1',
  objectKey: 'farms/finca-1/evidence/x-foto.jpg',
  capturedAt: '2026-06-18T13:14:00.000Z',
  status: 'PENDIENTE',
  visibility: 'PRIVADA',
  moderationScore: '0.9200',
  moderationEngine: 'NSFWJS',
  rejectionReason: null,
  geolocation: { lat: 1.85, lng: -76.05 },
  createdAt: '2026-06-18T14:00:00.000Z',
}

function api(extra: Record<string, unknown> = {}) {
  return mockApi({
    'GET /farms': [],
    'GET /evidence/moderation/pending': [evidencia],
    'POST /evidence/download-url': { url: 'https://r2.test/foto.jpg', expiresIn: 300 },
    ...extra,
  })
}

describe('EvidenciasPage', () => {
  it('muestra la cola sin exponer las coordenadas', async () => {
    api()
    renderWithAuth(<EvidenciasPage />)
    expect(await screen.findByText('92 / 100')).toBeInTheDocument()
    expect(screen.getByText('Con geolocalización')).toBeInTheDocument()
    expect(screen.queryByText(/-76/)).not.toBeInTheDocument()
  })

  it('rechazar exige un motivo y lo envía', async () => {
    const calls = api({ 'PATCH /evidence/e1/moderation': { ...evidencia, status: 'RECHAZADA' } })
    renderWithAuth(<EvidenciasPage />)
    const user = userEvent.setup()

    const rechazar = await screen.findByRole('button', { name: 'Rechazar' })
    expect(rechazar).toBeDisabled()
    await user.type(screen.getByLabelText('Motivo u observación'), 'Foto borrosa')
    await user.click(rechazar)

    expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ status: 'RECHAZADA', rejectionReason: 'Foto borrosa' })
  })
})
