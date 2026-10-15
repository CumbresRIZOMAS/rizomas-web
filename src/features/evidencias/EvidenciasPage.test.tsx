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
  status: 'EN_REVISION',
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
    'GET /evidence/moderation/summary': { PENDIENTE: 0, EN_REVISION: 1, CUARENTENA: 0, APROBADA: 0, RECHAZADA: 0 },
    'GET /evidence/moderation?status=EN_REVISION': [evidencia],
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

  it('al aprobar puede autorizarla para el portal público', async () => {
    const calls = api({ 'PATCH /evidence/e1/moderation': { ...evidencia, status: 'APROBADA' } })
    renderWithAuth(<EvidenciasPage />)
    const user = userEvent.setup()

    await user.click(await screen.findByLabelText(/Autorizar para el portal público/))
    await user.click(screen.getByRole('button', { name: 'Aprobar' }))
    expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ status: 'APROBADA', visibility: 'PUBLICA' })
  })

  it('muestra los conteos de cada bandeja', async () => {
    api()
    renderWithAuth(<EvidenciasPage />)
    expect(await screen.findByRole('tab', { name: 'Por revisar 1' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Cuarentena 0' })).toBeInTheDocument()
  })
})
