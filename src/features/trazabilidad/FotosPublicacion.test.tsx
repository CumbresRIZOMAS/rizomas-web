import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { mockApi, renderWithAuth } from '../../test/utils'
import { FotosPublicacion } from './FotosPublicacion'

const foto = (id: string, linked: boolean) => ({ id, objectKey: `farms/f1/evidence/${id}.jpg`, capturedAt: '2026-06-18T00:00:00.000Z', laborId: 'l1', linked })

describe('FotosPublicacion', () => {
  it('parte de las fotos ya asociadas y guarda la nueva selección', async () => {
    const calls = mockApi({
      'GET /farms': [],
      'GET /publications/p1/photo-candidates': [foto('e1', true), foto('e2', false)],
      'POST /evidence/download-url': { url: 'https://r2.test/x.jpg', expiresIn: 300 },
      'PUT /publications/p1/evidences': { evidenceIds: ['e2'] },
    })
    const onSaved = vi.fn()
    renderWithAuth(<FotosPublicacion publicationId="p1" onSaved={onSaved} onCancel={vi.fn()} />)
    const user = userEvent.setup()

    const [primera, segunda] = await screen.findAllByRole('button', { pressed: undefined, name: /Foto de labor/ })
    expect(primera).toHaveAttribute('aria-pressed', 'true')
    await user.click(primera)
    await user.click(segunda)
    await user.click(screen.getByRole('button', { name: 'Guardar fotos' }))

    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ evidenceIds: ['e2'] })
    expect(onSaved).toHaveBeenCalled()
  })

  it('explica cómo conseguir fotos si no hay ninguna aprobada como pública', async () => {
    mockApi({ 'GET /farms': [], 'GET /publications/p1/photo-candidates': [] })
    renderWithAuth(<FotosPublicacion publicationId="p1" onSaved={vi.fn()} onCancel={vi.fn()} />)
    expect(await screen.findByText(/Autorizar para el portal público/)).toBeInTheDocument()
  })
})
