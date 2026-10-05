import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
  const [loading, setLoading] = useState(configurado)

  useEffect(() => {
    if (!configurado) return
    supabase()
      .auth.getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setLoading(false))
    const { data } = supabase().auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [configurado])

  const value = useMemo<Auth>(() => {
    const token = session?.access_token ?? null
    return {
      token,
      email: session?.user.email ?? null,
      role: token ? roleFromToken(token) : null,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase().auth.signInWithPassword({ email, password })
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message)
      },
      signOut: async () => {
        await supabase().auth.signOut()
      },
    }
  }, [session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

