import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Role } from '../api/types'
import { api, ApiError } from '../api/client'
import { clearApiQueryCache } from '../api/hooks'
import { env, missingEnv } from '../config/env'
import { AuthContext, roleFromToken, type Auth } from './context'

let client: SupabaseClient | null = null
function supabase(): SupabaseClient {
  client ??= createClient(env.supabaseUrl, env.supabaseAnonKey)
  return client
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configurado = missingEnv().length === 0
  const [session, setSession] = useState<Session | null>(null)
  const [backendRole, setBackendRole] = useState<Role | null>(null)
  const [initializing, setInitializing] = useState(configurado)
  const [validatingLogin, setValidatingLogin] = useState(false)
  const signOut = useCallback(async () => {
    await supabase().auth.signOut()
    clearApiQueryCache()
    setSession(null)
    setBackendRole(null)
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
          const bootstrap = await api<{ user?: { role?: Role } | null }>('/sync/pull', { token: restored.access_token })
          if (mounted) setBackendRole(bootstrap.user?.role ?? null)
        } catch (error) {
          // Igual que en móvil, un fallo de red no borra la sesión local.
          // Las peticiones de datos mostrarán el estado del backend al entrar.
          if (error instanceof ApiError && error.status === 401) {
            sessionValid = false
            await auth.signOut()
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
      role: backendRole ?? (token ? roleFromToken(token) : null),
      loading: initializing || validatingLogin,
      signIn: async (email, password) => {
        setValidatingLogin(true)
        try {
          const { data, error } = await supabase().auth.signInWithPassword({ email, password })
          if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message)
          if (!data.session) throw new Error('Supabase no devolvió una sesión válida')
          setSession(data.session)
          setBackendRole(roleFromToken(data.session.access_token))
          // Carga el rol del backend en segundo plano; un fallo temporal de datos
          // no debe bloquear ni borrar la sesión que Supabase acaba de validar.
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
        } finally {
          setValidatingLogin(false)
        }
      },
      setPassword: async (password) => {
        const { error } = await supabase().auth.updateUser({ password })
        if (error) throw new Error(error.message)
      },
      signOut,
    }
  }, [session, backendRole, initializing, validatingLogin, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

