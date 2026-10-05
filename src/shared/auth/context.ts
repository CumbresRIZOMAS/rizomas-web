import { createContext, useContext } from 'react'

export type Role =
  | 'ADMIN_CUMBRES'
  | 'ADMIN_FINCA'
  | 'TECNICO'
  | 'AGRICULTOR'
  | 'PROVEEDOR'
  | 'COMPRADOR_CERTIFICADORA'
  | 'CLIENTE'
  | 'PUBLICO'

export type Auth = {
  token: string | null
  email: string | null
  role: Role | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<Auth | null>(null)

/**
 * Rol del usuario según el JWT (custom claim `user_role` del Auth Hook).
 * Solo sirve para mostrar u ocultar acciones: los permisos reales los valida
 * el backend (ASR-01).
 */
export function roleFromToken(token: string): Role | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.user_role ?? payload.app_metadata?.user_role ?? null
  } catch {
    return null
  }
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return auth
}

/**
 * ¿Mostrar esta acción? Espejo de los @Roles del backend, solo cosmético.
 * Si el token no trae rol (Auth Hook sin configurar; el backend lo toma de su
 * tabla de usuarios), se muestra y el backend responde 403 si no corresponde.
 */
export function canDo(role: Role | null, allowed: readonly Role[]): boolean {
  return role === null || allowed.includes(role)
}

export const ROLES = {
  crearFinca: ['ADMIN_CUMBRES', 'ADMIN_FINCA', 'TECNICO'],
  editarFinca: ['ADMIN_CUMBRES', 'ADMIN_FINCA'],
  registrarEnFinca: ['ADMIN_CUMBRES', 'ADMIN_FINCA', 'TECNICO', 'AGRICULTOR'],
  verRangosSuelo: ['ADMIN_CUMBRES', 'ADMIN_FINCA', 'TECNICO'],
  editarRangosSuelo: ['ADMIN_CUMBRES', 'TECNICO'],
} as const satisfies Record<string, readonly Role[]>
