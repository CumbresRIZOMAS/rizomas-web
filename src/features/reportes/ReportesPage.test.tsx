import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakeAuth, mockApi, renderWithAuth } from '../../test/utils'
import { clearApiQueryCache } from '../../shared/api/hooks'
import { ReportesPage } from './ReportesPage'

describe('ReportesPage', () => {
  it('permite elegir y solicitar el reporte de trazabilidad', async () => {
    clearApiQueryCache()
    const today = new Date()
    const endDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
    const queryPath = `/reports?farmId=f1&type=traceability&from=2026-01-01&to=${endDate}`
    const calls = mockApi({
      'GET /farms': [{ id: 'f1', name: 'El Rosal' }],
      [`GET ${queryPath}`]: {
        type: 'traceability', farmId: 'f1', generatedAt: '2026-11-02T12:00:00Z', totals: { processes: 1, events: 2 },
        processes: [{
          id: 'cp1', currentStage: 'Secado', startedAt: '2026-05-10T00:00:00Z',
          events: [{ stage: 'Lavado', waterLiters: 240, wastewaterLiters: 180 }],
          products: [{ destination: 'Tostión', quantity: 18, certifications: [{ name: 'Orgánico' }] }],
        }],
      },
    })
    renderWithAuth(<ReportesPage />, { auth: fakeAuth('ADMIN_FINCA') })

    const tipo = await screen.findByRole('combobox', { name: 'Tipo de reporte' })
    expect([...tipo.querySelectorAll('option')].map((option) => option.value)).toEqual(['production', 'environmental', 'technical', 'social', 'commercial', 'traceability'])
    fireEvent.change(tipo, { target: { value: 'traceability' } })
    fireEvent.change(screen.getByLabelText('Fecha inicial'), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText('Fecha final'), { target: { value: endDate } })
    fireEvent.click(screen.getByRole('button', { name: 'Generar vista previa' }))

    await waitFor(() => expect(screen.getAllByText('Procesos de café').length).toBeGreaterThan(0))
    expect(screen.getByText('Secado')).toBeInTheDocument()
    expect(screen.getByText('Etapas del proceso')).toBeInTheDocument()
    expect(screen.getByText('Lavado')).toBeInTheDocument()
    expect(screen.getByText('Agua limpia (L)')).toBeInTheDocument()
    expect(screen.getByText('Agua residual (L)')).toBeInTheDocument()
    expect(screen.getAllByText(/Productos obtenidos/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Certificaciones/).length).toBeGreaterThan(0)
    expect(screen.getByText('Orgánico')).toBeInTheDocument()
    expect([...document.querySelectorAll('.report-preview td')].some((cell) => /[{}\[\]]/.test(cell.textContent ?? ''))).toBe(false)
    expect(calls.some((call) => call.url === queryPath)).toBe(true)
  })
})
