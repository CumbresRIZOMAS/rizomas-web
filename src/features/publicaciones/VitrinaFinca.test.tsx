import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PublicFarmTraceability } from '../../shared/api/types'
import { VitrinaFinca } from './VitrinaFinca'

const evento = (stage: string, dia: number, extra: object = {}) => ({ stage, recordedAt: `2026-11-0${dia}T12:00:00.000Z`, inputKg: null, outputKg: null, ...extra })

const traza: PublicFarmTraceability = {
  origin: { region: 'HUILA', farmType: 'EN_TRANSICION' },
  crop: { species: 'Café arábica', variety: null },
  harvest: { date: '2026-11-04T12:00:00.000Z', quantity: '15', unit: 'kg', quality: null },
  practices: { laborsByType: {}, soilAnalyses: 0, bioinputApplications: 0, recommendations: 0 },
  lotsCount: 2,
  cropsCount: 1,
  harvestsCount: 1,
  processes: [
    {
      stage: 'Catación',
      startedAt: '2026-11-01T12:00:00.000Z',
      finishedAt: null,
      products: [],
      events: [
        evento('Cosecha', 1, { outputKg: '10', method: 'Honey rojo · Marquesina' }),
        evento('Despulpado', 2, { inputKg: '10', outputKg: '9' }),
        evento('Secado', 3, { outputKg: '7', moisturePercent: '11' }),
        evento('Catación', 4, { scaScore: '90.5', flavorNotes: ['Chocolate', 'Frutal'] }),
      ],
    },
  ],
}

describe('VitrinaFinca', () => {
  it('destaca el puntaje de taza, las notas de sabor y el tipo de proceso', () => {
    render(<VitrinaFinca traza={traza} nombre="Villa Vista" />)
    expect(screen.getByRole('heading', { name: 'Excepcional' })).toBeInTheDocument()
    expect(screen.getByText('90,5')).toBeInTheDocument()
    expect(screen.getByText(/Chocolate/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Proceso Honey rojo' })).toBeInTheDocument()
    expect(screen.getByText('10 → 9 kg')).toBeInTheDocument()
    expect(screen.getByText(/Secado al punto ideal/)).toBeInTheDocument()
    expect(screen.getByText('lotes de café')).toBeInTheDocument()
  })

  it('sin catación no inventa puntaje', () => {
    const sinCata = { ...traza, processes: [{ ...traza.processes[0], events: traza.processes[0].events.slice(0, 2) }] }
    render(<VitrinaFinca traza={sinCata} nombre="Villa Vista" />)
    expect(screen.queryByText(/puntos SCA/)).not.toBeInTheDocument()
    expect(screen.getByText('Despulpado')).toBeInTheDocument()
  })
})
