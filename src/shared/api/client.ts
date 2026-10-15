import { env } from '../config/env'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type ApiOptions = Omit<RequestInit, 'body'> & { token?: string; body?: unknown }

// Cliente HTTP único contra rizomas-backend (prefijo /api/v1).
// El token es el JWT de Supabase Auth; el backend valida rol y permisos.
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers, body, ...rest } = options
  let response: Response
  try {
    response = await fetch(`${env.apiUrl}/api/v1${path}`, {
      ...rest,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa tu conexión.')
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    // NestJS devuelve los errores de validación como lista de mensajes.
    const message = Array.isArray(data.message) ? data.message.join('. ') : data.message
    throw new ApiError(response.status, message ?? response.statusText)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
