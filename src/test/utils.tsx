import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { vi } from 'vitest'
import { AuthContext, type Auth, type Role } from '../shared/auth/context'
import { ActiveFarmProvider } from '../shared/farm/ActiveFarmProvider'

export type FetchCall = { url: string; method: string; body: unknown }

/**
 * Simula el backend: `routes` mapea "MÉTODO /ruta" a la respuesta (o a un
 * número de estado HTTP para responder con error). Devuelve las llamadas hechas.
 */
export function mockApi(routes: Record<string, unknown>) {
  const calls: FetchCall[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = input.replace('http://api.test/api/v1', '')
      const method = init?.method ?? 'GET'
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      const key = `${method} ${url}`
      if (!(key in routes)) return new Response(JSON.stringify({ message: `Sin mock para ${key}` }), { status: 500 })
      const value = routes[key]
      if (typeof value === 'number') return new Response(JSON.stringify({ message: 'Error simulado' }), { status: value })
      return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
  return calls
}

export function fakeAuth(role: Role | null = 'TECNICO', overrides: Partial<Auth> = {}): Auth {
  return {
    token: 'token-de-prueba',
    email: 'tecnico@cumbres.co',
    role,
    loading: false,
    signIn: vi.fn(),
    setPassword: vi.fn(),
    signOut: vi.fn(async () => {}),
    ...overrides,
  }
}

/** Renderiza con sesión simulada, finca activa (GET /farms) y router en la ruta indicada. */
export function renderWithAuth(ui: ReactElement, { auth = fakeAuth(), path = '/', route = '/' }: { auth?: Auth; path?: string; route?: string } = {}) {
  return render(
    <AuthContext.Provider value={auth}>
      <ActiveFarmProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={ui} />
            <Route path="*" element={<p>Otra página</p>} />
          </Routes>
        </MemoryRouter>
      </ActiveFarmProvider>
    </AuthContext.Provider>,
  )
}
