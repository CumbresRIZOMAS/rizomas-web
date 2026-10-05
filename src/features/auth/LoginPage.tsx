import { useState, type FormEvent } from 'react'
import { missingEnv } from '../../shared/config/env'
import { useAuth } from '../../shared/auth/context'
import { TextField } from '../../shared/ui'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const faltantes = missingEnv()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="login">
      <div className="login-card">
        <div className="login-brand">
          <h1>RIZOMAS</h1>
          <p>Panel técnico y administrativo</p>
        </div>
        <div className="login-body">
          {faltantes.length > 0 ? (
            <div className="notice notice-warn" role="alert">
              El panel no está configurado. Faltan las variables: {faltantes.join(', ')}.
            </div>
          ) : (
            <form className="form" onSubmit={onSubmit}>
              <TextField label="Correo" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <TextField
                label="Contraseña"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && (
                <div className="notice notice-error" role="alert">
                  {error}
                </div>
              )}
              <button className="btn btn-primary" type="submit" disabled={enviando}>
                {enviando ? 'Ingresando…' : 'Iniciar sesión'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
