import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../shared/auth/context'
import { clearApiQueryCache } from '../../shared/api/hooks'
import { fakeAuth, mockApi } from '../../test/utils'
import { PortalPublico } from './PortalPublico'

// jsdom no tiene WebGL: el mapa 3D cae a su mensaje alterno y la lista sigue funcionando.
vi.mock('maplibre-gl', () => ({
  default: {
    Map: class {
      constructor() {
        throw new Error('WebGL no disponible')
      }
    },
  },
}))

const ORIGEN = {
  id: 'farm:f1', title: 'EL ROSAL', farmName: 'EL ROSAL', municipality: 'PITALITO', region: 'HUILA',
  quantity: null, unit: null, publishedAt: null, evidences: [], isPublished: false,
}

describe('PortalPublico', () => {
  it('muestra las fincas con ubicación aunque no hayan publicado trazabilidad, con nombres legibles', async () => {
    clearApiQueryCache()
    mockApi({ 'GET /publications': [], 'GET /publications/origins': [ORIGEN] })
    render(<AuthContext.Provider value={fakeAuth(null, { token: null })}><MemoryRouter><PortalPublico /></MemoryRouter></AuthContext.Provider>)

    await waitFor(() => expect(screen.getAllByText('El Rosal').length).toBeGreaterThan(0))
    expect(screen.getAllByText(/Pitalito, Huila/).length).toBeGreaterThan(0)
    expect(await screen.findByText(/mapa 3D no está disponible|3D map is not available/)).toBeInTheDocument()
  })

  it('muestra la bibliografía cerrada y la despliega al pedirla', async () => {
    clearApiQueryCache()
    mockApi({ 'GET /publications': [], 'GET /publications/origins': [] })
    render(<AuthContext.Provider value={fakeAuth(null, { token: null })}><MemoryRouter><PortalPublico /></MemoryRouter></AuthContext.Provider>)

    const bibliografia = screen.getByRole('region', { name: 'Fuentes y créditos' })
    expect(bibliografia).not.toHaveTextContent('Evaluaciones Agropecuarias Municipales')
    await userEvent.click(screen.getByRole('button', { name: /Fuentes y créditos/ }))
    expect(bibliografia).toHaveTextContent('Evaluaciones Agropecuarias Municipales')
    expect(bibliografia).toHaveTextContent('Registro Único Nacional de Áreas Protegidas')
    expect(bibliografia.querySelector('a[href="https://www.datos.gov.co/d/uejq-wxrr"]')).not.toBeNull()
  })

  it('al elegir una finca muestra su ficha rápida con lo documentado', async () => {
    clearApiQueryCache()
    mockApi({
      'GET /publications': [],
      'GET /publications/origins': [ORIGEN],
      'GET /publications/farms/f1/traceability': {
        origin: { region: 'Huila', farmType: 'REGENERATIVA' },
        crop: { species: 'Café arábica', variety: 'Castillo' },
        harvest: null,
        practices: { laborsByType: { SIEMBRA: 2 }, soilAnalyses: 1, bioinputApplications: 0, recommendations: 0 },
        lotsCount: 2, cropsCount: 1, harvestsCount: 0,
        processes: [{ stage: 'SECADO', startedAt: '2026-09-18T17:00:00.000Z', finishedAt: null, events: [], products: [] }],
      },
    })
    render(<AuthContext.Provider value={fakeAuth(null, { token: null })}><MemoryRouter><PortalPublico /></MemoryRouter></AuthContext.Provider>)

    const tarjeta = (await screen.findAllByText('El Rosal')).map((el) => el.closest('button.rz-tarjeta')).find(Boolean)
    await userEvent.click(tarjeta as HTMLElement)
    const ficha = await screen.findByRole('complementary', { name: 'El Rosal' })
    await waitFor(() => expect(ficha).toHaveTextContent(/Castillo/))
    expect(ficha).toHaveTextContent(/Regenerativ/)
    expect(ficha).toHaveTextContent(/Secado|Drying/)
  })
})
