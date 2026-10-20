import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../shared/auth/context'
import { missingEnv } from '../../shared/config/env'
import { Icon } from '../../shared/ui'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verClave, setVerClave] = useState(false)
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
    <div className="login-page">
      <div className="login-art">
        <div className="login-brand">
          <div className="brand-mark">
            <Icon name="leaf" size={28} />
          </div>
          <strong>RIZOMAS</strong>
        </div>
        <div className="landscape" aria-hidden="true">
          <span className="sun" />
          <div className="mountain one" />
          <div className="mountain two" />
          <div className="coffee-plant">
            <Icon name="leaf" size={90} />
          </div>
        </div>
        <div className="login-quote">
          <span>TECNOLOGÍA CON RAÍCES</span>
          <h1>Cultivamos información para regenerar el territorio.</h1>
          <p>Trazabilidad, conocimiento y decisiones conscientes para el café colombiano.</p>
        </div>
      </div>
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={onSubmit}>
          <div className="mobile-brand">
            <Icon name="leaf" />
            <strong>RIZOMAS</strong>
          </div>
          <Link className="back-public" to="/">
            ← Ir a la página principal
          </Link>
          <span className="eyebrow">Bienvenido de nuevo</span>
          <h1>Ingresa a tu cuenta</h1>
          <p>Consulta y gestiona la información de tus fincas.</p>
          {faltantes.length > 0 ? (
            <div className="notice notice-warn" role="alert">
              El panel no está configurado. Faltan las variables: {faltantes.join(', ')}.
            </div>
          ) : (
            <>
              <label className="field">
                <span>Correo electrónico</span>
                <input type="email" autoComplete="email" required placeholder="nombre@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="field">
                <span>Contraseña</span>
                <div className="password-field">
                  <input
                    type={verClave ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setVerClave((v) => !v)}>
                    {verClave ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </label>
              {error && (
                <div className="notice notice-error" role="alert">
                  {error}
                </div>
              )}
              <button className="btn btn-primary" type="submit" disabled={enviando}>
                {enviando ? 'Ingresando…' : 'Ingresar al panel'} <Icon name="arrow" />
              </button>
              <div className="secure">
                <Icon name="lock" size={17} />
                <span>Conexión segura y datos protegidos</span>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
