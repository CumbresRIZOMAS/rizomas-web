import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/context'
import { api, ApiError } from './client'

type Query<T> = {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

type CacheEntry = { data: unknown; updatedAt: number }
const queryCache = new Map<string, CacheEntry>()
const authScopes = new WeakMap<() => Promise<void>, number>()
const CACHE_TTL_MS = 60_000
const MAX_CACHE_ENTRIES = 200
let nextAuthScope = 1

function authScopeId(signOut: () => Promise<void>): number {
  let id = authScopes.get(signOut)
  if (id === undefined) {
    id = nextAuthScope++
    authScopes.set(signOut, id)
  }
  return id
}

function saveQuery(key: string, data: unknown) {
  queryCache.delete(key)
  queryCache.set(key, { data, updatedAt: Date.now() })
  while (queryCache.size > MAX_CACHE_ENTRIES) {
    const oldest = queryCache.keys().next().value
    if (oldest === undefined) break
    queryCache.delete(oldest)
  }
}

/** Limpia datos privados al cerrar sesión. */
export function clearApiQueryCache() {
  queryCache.clear()
}

/** Las mutaciones dejan los datos en memoria, pero fuerzan su actualización al volver a consultarlos. */
function markApiQueryCacheStale() {
  for (const [key, entry] of queryCache) queryCache.set(key, { ...entry, updatedAt: 0 })
}

/** GET autenticado. Si la sesión expiró (401), cierra la sesión. */
export function useApiQuery<T>(path: string | null): Query<T> {
  const { token, signOut } = useAuth()
  const [version, setVersion] = useState(0)
  // La clave separa fincas/consultas y sesiones para no mezclar datos entre usuarios.
  const key = path === null ? null : `${authScopeId(signOut)}:${token ?? 'anonymous'}:${path}`
  const [result, setResult] = useState<{ key: string | null; data: T | null; error: string | null }>({ key: null, data: null, error: null })

  useEffect(() => {
    if (key === null || path === null) return
    let vigente = true
    const cached = queryCache.get(key)
    if (cached) {
      setResult({ key, data: cached.data as T, error: null })
      if (Date.now() - cached.updatedAt < CACHE_TTL_MS) return () => { vigente = false }
    }
    api<T>(path, { token: token ?? undefined })
      .then((data) => {
        if (vigente) {
          saveQuery(key, data)
          setResult({ key, data, error: null })
        }
      })
      .catch((e: unknown) => {
        if (!vigente) return
        if (e instanceof ApiError && e.status === 401) void signOut()
        // Conserva los datos anteriores para no vaciar la pantalla por un error al recargar.
        setResult((prev) => ({ key, data: prev.key === key ? prev.data : (cached?.data as T | undefined) ?? null, error: mensaje(e) }))
      })
    return () => {
      vigente = false
    }
  }, [key, path, token, signOut, version])

  const reload = useCallback(() => {
    if (key) queryCache.delete(key)
    setVersion((v) => v + 1)
  }, [key])
  const cached = key === null ? undefined : queryCache.get(key)
  const data = key === null ? null : result.key === key ? result.data : (cached?.data as T | undefined) ?? null
  const loading = key !== null && data === null && result.key !== key
  const error = result.key === key ? result.error : null
  return { data, error, loading, reload }
}

/** Mutación autenticada. Devuelve la función y su estado. */
export function useApiMutation() {
  const { token, signOut } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = useCallback(
    async <T>(path: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<T | null> => {
      setSaving(true)
      setError(null)
      try {
        const result = await api<T>(path, { method, body, token: token ?? undefined })
        markApiQueryCacheStale()
        return result
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
