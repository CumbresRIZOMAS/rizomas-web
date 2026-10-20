import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Role } from '../api/types'
import { api, ApiError } from '../api/client'
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

  useEffect(() => {
    if (!configurado) return
    let mounted = true
    const auth = supabase().auth
    const { data } = auth.onAuthStateChange((event, next) => {
      if (!mounted) return
      if (event === 'SIGNED_OUT') {
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
          const bootstrap = await api<{ user?: { role?: Role } | null }>('/sync/pull', { token: data.session.access_token })
          setSession(data.session)
          setBackendRole(bootstrap.user?.role ?? null)
        } catch (error) {
          await supabase().auth.signOut()
          setBackendRole(null)
          if (error instanceof ApiError) throw new Error(`No se pudo validar el acceso con el servidor: ${error.message}`)
          throw error
        } finally {
          setValidatingLogin(false)
        }
      },
      setPassword: async (password) => {
        const { error } = await supabase().auth.updateUser({ password })
        if (error) throw new Error(error.message)
      },
      signOut: async () => {
        await supabase().auth.signOut()
        setSession(null)
        setBackendRole(null)
      },
    }
  }, [session, backendRole, initializing, validatingLogin])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

