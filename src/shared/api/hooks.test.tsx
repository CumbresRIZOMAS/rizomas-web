import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { fakeAuth, mockApi } from '../../test/utils'
import { AuthContext } from '../auth/context'
import { useApiQuery } from './hooks'

describe('useApiQuery', () => {
  it('manda el token y devuelve los datos', async () => {
    mockApi({ 'GET /farms': [{ id: 'f1' }] })
    const auth = fakeAuth()
    const wrapper = ({ children }: { children: ReactNode }) => <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    const { result } = renderHook(() => useApiQuery<{ id: string }[]>('/farms'), { wrapper })

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual([{ id: 'f1' }])
    const [, init] = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-de-prueba')
  })

  it('si la sesión expiró (401) cierra la sesión', async () => {
    mockApi({ 'GET /farms': 401 })
    const auth = fakeAuth()
    const wrapper = ({ children }: { children: ReactNode }) => <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    const { result } = renderHook(() => useApiQuery('/farms'), { wrapper })

    await waitFor(() => expect(result.current.error).toBe('Tu sesión expiró. Vuelve a iniciar sesión.'))
    expect(auth.signOut).toHaveBeenCalled()
  })

  it('traduce el 403 a un mensaje de permisos', async () => {
    mockApi({ 'GET /farms': 403 })
    const wrapper = ({ children }: { children: ReactNode }) => <AuthContext.Provider value={fakeAuth()}>{children}</AuthContext.Provider>
    const { result } = renderHook(() => useApiQuery('/farms'), { wrapper })
    await waitFor(() => expect(result.current.error).toBe('No tienes permisos para esta operación.'))
  })
})
