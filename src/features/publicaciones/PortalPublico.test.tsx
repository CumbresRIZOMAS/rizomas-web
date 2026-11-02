import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthContext } from '../../shared/auth/context'
import { clearApiQueryCache } from '../../shared/api/hooks'
import { fakeAuth, mockApi } from '../../test/utils'
import { PortalPublico } from './PortalPublico'

describe('PortalPublico', () => {
  it('muestra las fincas que tienen ubicación aunque no hayan publicado trazabilidad', async () => {
    clearApiQueryCache()
    mockApi({
      'GET /publications': [],
      'GET /publications/origins': [{
        id: 'farm:f1', title: 'El Rosal', farmName: 'El Rosal', municipality: 'Pitalito', region: 'Huila',
        quantity: null, unit: null, publishedAt: null, evidences: [], isPublished: false,
      }],
    })
    render(<AuthContext.Provider value={fakeAuth(null, { token: null })}><MemoryRouter><PortalPublico /></MemoryRouter></AuthContext.Provider>)

    await waitFor(() => expect(screen.getAllByText('El Rosal').length).toBeGreaterThan(0))
    expect(screen.getAllByText(/Pitalito, Huila/).length).toBeGreaterThan(0)
    expect(screen.getByText('Aún no publicada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Conocer este origen/ })).not.toBeInTheDocument()
  })
})
