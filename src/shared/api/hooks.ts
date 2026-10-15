import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/context'
import { api, ApiError } from './client'

type Query<T> = {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

/** GET autenticado. Si la sesión expiró (401), cierra la sesión. */
export function useApiQuery<T>(path: string | null): Query<T> {
  const { token, signOut } = useAuth()
  const [version, setVersion] = useState(0)
  // Cada petición tiene una clave; "cargando" = aún no llegó la respuesta de la clave actual.
  const key = path === null ? null : `${version}:${path}`
  const [result, setResult] = useState<{ key: string | null; data: T | null; error: string | null }>({ key: null, data: null, error: null })

  useEffect(() => {
    if (key === null || path === null) return
    let vigente = true
    api<T>(path, { token: token ?? undefined })
      .then((data) => {
        if (vigente) setResult({ key, data, error: null })
      })
      .catch((e: unknown) => {
        if (!vigente) return
        if (e instanceof ApiError && e.status === 401) void signOut()
        // Conserva los datos anteriores para no vaciar la pantalla por un error al recargar.
        setResult((prev) => ({ key, data: prev.data, error: mensaje(e) }))
      })
    return () => {
      vigente = false
    }
  }, [key, path, token, signOut])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const loading = key !== null && result.key !== key
  return { data: result.data, error: loading ? null : result.error, loading, reload }
}

/** POST/PATCH/DELETE autenticado. Devuelve la función y su estado. */
export function useApiMutation() {
  const { token, signOut } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = useCallback(
    async <T>(path: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<T | null> => {
      setSaving(true)
      setError(null)
      try {
        return await api<T>(path, { method, body, token: token ?? undefined })
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) void signOut()
        setError(mensaje(e))
        return null
      } finally {
        setSaving(false)
      }
    },
    [token, signOut],
  )

  return { mutate, saving, error, clearError: () => setError(null) }
}

function mensaje(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 403) return 'No tienes permisos para esta operación.'
    if (e.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.'
    return e.message
  }
  return 'Ocurrió un error inesperado.'
}
