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
const CACHE_TTL_MS = 15 * 60_000
const MAX_CACHE_ENTRIES = 200
const STORAGE_PREFIX = 'rizomas:api-query:v2:'

function subjectFromToken(token: string): string {
  try {
    const payload = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/')
    if (payload) {
      const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))) as { sub?: unknown }
      if (typeof claims.sub === 'string' && claims.sub) return claims.sub
    }
  } catch {
    // Los tokens de prueba o inválidos igual reciben un ámbito estable.
  }
  let hash = 2166136261
  for (let i = 0; i < token.length; i += 1) hash = Math.imul(hash ^ token.charCodeAt(i), 16777619)
  return `session-${(hash >>> 0).toString(36)}`
}

function persistentKey(key: string) {
  return `${STORAGE_PREFIX}${key}`
}

function readQuery(key: string): CacheEntry | undefined {
  const inMemory = queryCache.get(key)
  if (inMemory) return inMemory
  try {
    const raw = sessionStorage.getItem(persistentKey(key))
    if (!raw) return undefined
    const entry = JSON.parse(raw) as CacheEntry
    if (typeof entry.updatedAt !== 'number' || !('data' in entry)) return undefined
    queryCache.set(key, entry)
    return entry
  } catch {
    return undefined
  }
}

function saveQuery(key: string, data: unknown) {
  queryCache.delete(key)
  const entry = { data, updatedAt: Date.now() }
  queryCache.set(key, entry)
  try {
    sessionStorage.setItem(persistentKey(key), JSON.stringify(entry))
  } catch {
    // La caché en memoria sigue funcionando si el almacenamiento está lleno o bloqueado.
  }
  while (queryCache.size > MAX_CACHE_ENTRIES) {
    const oldest = queryCache.keys().next().value
    if (oldest === undefined) break
    queryCache.delete(oldest)
    try {
      sessionStorage.removeItem(persistentKey(oldest))
    } catch {
      // La caché en memoria sigue limitada aunque no se pueda limpiar el almacenamiento.
    }
  }
}

/** Limpia datos privados al cerrar sesión. */
export function clearApiQueryCache() {
  queryCache.clear()
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(STORAGE_PREFIX)) sessionStorage.removeItem(key)
    }
  } catch {
    // El cierre de sesión no depende de que sessionStorage esté disponible.
  }
}

/** Las mutaciones dejan los datos en memoria, pero fuerzan su actualización al volver a consultarlos. */
function markApiQueryCacheStale() {
  for (const [key, entry] of queryCache) {
    const stale = { ...entry, updatedAt: 0 }
    queryCache.set(key, stale)
    try {
      sessionStorage.setItem(persistentKey(key), JSON.stringify(stale))
    } catch {
      // Se conserva la marca de vencimiento de la caché en memoria.
    }
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i)
      if (!key?.startsWith(STORAGE_PREFIX)) continue
      const raw = sessionStorage.getItem(key)
      if (!raw) continue
      const entry = JSON.parse(raw) as CacheEntry
      if (typeof entry.updatedAt === 'number') sessionStorage.setItem(key, JSON.stringify({ ...entry, updatedAt: 0 }))
    }
  } catch {
    // Las mutaciones nunca fallan por un problema al invalidar la caché del navegador.
  }
}

/** GET autenticado. Si la sesión expiró (401), cierra la sesión. */
export function useApiQuery<T>(path: string | null): Query<T> {
  const { token, role, signOut } = useAuth()
  const [version, setVersion] = useState(0)
  // La clave separa fincas/consultas y sesiones para no mezclar datos entre usuarios.
  const scope = token ? `user:${subjectFromToken(token)}:${role ?? 'pending'}` : 'public'
  const key = path === null ? null : `${scope}:${path}`
  const [result, setResult] = useState<{ key: string | null; data: T | null; error: string | null }>({ key: null, data: null, error: null })

  useEffect(() => {
    if (key === null || path === null) return
    let vigente = true
    const cached = readQuery(key)
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
    if (key) {
      queryCache.delete(key)
      try {
        sessionStorage.removeItem(persistentKey(key))
      } catch {
        // La consulta igual vuelve a ejecutarse por el cambio de versión.
      }
    }
    setVersion((v) => v + 1)
  }, [key])
  const cached = key === null ? undefined : readQuery(key)
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
