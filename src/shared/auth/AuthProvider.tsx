import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Role } from '../api/types'
import { api, ApiError } from '../api/client'
import { clearApiQueryCache } from '../api/hooks'
import { env, missingEnv } from '../config/env'
import { AuthContext, roleFromToken, type Auth } from './context'
import { normalizePhone } from './phone'

let client: SupabaseClient | null = null
function supabase(): SupabaseClient {
  client ??= createClient(env.supabaseUrl, env.supabaseAnonKey)
  return client
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configurado = missingEnv().length === 0
  const [session, setSession] = useState<Session | null>(null)
  const [backendRole, setBackendRole] = useState<Role | null>(null)
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false)
  const [initializing, setInitializing] = useState(configurado)
  const [validatingLogin, setValidatingLogin] = useState(false)
  const signOut = useCallback(async () => {
    await supabase().auth.signOut()
    clearApiQueryCache()
    setSession(null)
    setBackendRole(null)
    setPasswordChangeRequired(false)
  }, [])

  useEffect(() => {
    if (!configurado) return
    let mounted = true
    const auth = supabase().auth
    const { data } = auth.onAuthStateChange((event, next) => {
      if (!mounted) return
      if (event === 'SIGNED_OUT') {
        clearApiQueryCache()
        setSession(null)
        setBackendRole(null)
      } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setSession(next)
      }
    })
    void auth.getSession().then(async ({ data: result, error }) => {
      if (!mounted) return
      if (error) throw error
      const restored = result.session
      let sessionValid = true
      if (restored) {
        try {
          const security = await api<{ required: boolean }>('/auth/password-status', { token: restored.access_token })
          if (mounted) setPasswordChangeRequired(security.required)
          if (!security.required) {
            const bootstrap = await api<{ user?: { role?: Role } | null }>('/sync/pull', { token: restored.access_token })
            if (mounted) setBackendRole(bootstrap.user?.role ?? null)
          }
        } catch (error) {
          // Igual que en móvil, un fallo de red no borra la sesión local.
          // Las peticiones de datos mostrarán el estado del backend al entrar.
          if (error instanceof ApiError && error.status === 401) {
            sessionValid = false
            await auth.signOut()
          }
          if (error instanceof ApiError && error.status === 403 && error.message === 'PASSWORD_CHANGE_REQUIRED' && mounted) {
            setPasswordChangeRequired(true)
          }
        }
      }
      if (mounted) setSession(sessionValid ? restored : null)
    }).catch(() => {
      if (mounted) setSession(null)
    }).finally(() => {
      if (mounted) setInitializing(false)
    })
    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [configurado])

  const value = useMemo<Auth>(() => {
    const token = session?.access_token ?? null
    return {
      token,
      email: session?.user.email ?? null,
      identity: session?.user.email ?? session?.user.phone ?? null,
      userId: session?.user.id ?? null,
      passwordChangeRequired,
      role: backendRole ?? (token ? roleFromToken(token) : null),
      loading: initializing || validatingLogin,
      signIn: async (identifier, password) => {
        setValidatingLogin(true)
        try {
          const credentials = identifier.includes('@')
            ? { email: identifier.trim().toLowerCase(), password }
            : { phone: normalizePhone(identifier), password }
          const { data, error } = await supabase().auth.signInWithPassword(credentials)
          if (error) {
            const authMessage = error.message.toLowerCase()
            if (
              error.code === 'phone_provider_disabled' ||
              authMessage.includes('phone_provider_disabled') ||
              (authMessage.includes('phone') && authMessage.includes('disabled') && (authMessage.includes('provider') || authMessage.includes('login')))
            ) {
              throw new Error('Supabase (phone_provider_disabled): el acceso con celular está desactivado. Habilita Authentication > Sign In / Providers > Phone en Supabase.')
            }
            if (error.code === 'phone_not_confirmed' || authMessage.includes('phone_not_confirmed')) {
              throw new Error('Supabase (phone_not_confirmed): el celular de esta cuenta aún no está confirmado. Un administrador debe revisar la cuenta.')
            }
            if (error.code === 'invalid_credentials' || error.message === 'Invalid login credentials') {
              throw new Error('Supabase (invalid_credentials): celular/correo o contraseña incorrectos. Para las cuentas migradas, prueba la cédula solo con números.')
            }
            throw new Error(`Supabase${error.code ? ` (${error.code})` : ''}: ${error.message}`)
          }
          if (!data.session) throw new Error('Supabase no devolvió una sesión válida')
          const security = await api<{ required: boolean }>('/auth/password-status', { token: data.session.access_token })
          setSession(data.session)
          setPasswordChangeRequired(security.required)
          setBackendRole(roleFromToken(data.session.access_token))
          if (!security.required) {
            void api<{ user?: { role?: Role } | null }>('/sync/pull', { token: data.session.access_token })
              .then((bootstrap) => setBackendRole(bootstrap.user?.role ?? roleFromToken(data.session.access_token)))
              .catch((bootstrapError) => {
                if (bootstrapError instanceof ApiError && bootstrapError.status === 401) {
                  void supabase().auth.signOut().then(() => {
                    setSession(null)
                    setBackendRole(null)
                  }).catch(() => undefined)
                }
              })
          }
        } finally {
          setValidatingLogin(false)
        }
      },
      setPassword: async (password) => {
        if (!token) throw new Error('Inicia sesión para cambiar la contraseña')
        await api('/auth/change-password', { method: 'POST', token, body: { password } })
        setPasswordChangeRequired(false)
      },
      signOut,
    }
  }, [session, backendRole, passwordChangeRequired, initializing, validatingLogin, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

