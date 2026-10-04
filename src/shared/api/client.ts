import { env } from '../config/env'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Cliente HTTP único contra rizomas-backend (prefijo /api/v1).
// El token es el JWT de Supabase Auth; el backend valida rol y permisos.
export async function api<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = options
  const response = await fetch(`${env.apiUrl}/api/v1${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, body.message ?? response.statusText)
  }
  return response.json() as Promise<T>
}
