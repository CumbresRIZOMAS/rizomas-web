import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../shared/auth/context'
import { Button, ErrorNotice, Icon, TextField } from '../../shared/ui'

export function RestablecerContrasenaPage() {
  const { token, loading, setPassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPasswordValue] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirmation) { setError('Las contraseñas no coinciden.'); return }
    setSaving(true)
    setError(null)
    try { await setPassword(password); setSaved(true) }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.') }
    finally { setSaving(false) }
  }

  return <div className="login-page"><div className="login-form-wrap"><form className="login-form" onSubmit={(e) => void submit(e)}>
    <div className="mobile-brand"><Icon name="leaf" /><strong>RIZOMAS</strong></div>
    <span className="eyebrow">Seguridad de la cuenta</span>
    <h1>{saved ? 'Contraseña actualizada' : 'Configura tu contraseña'}</h1>
    {loading ? <p>Verificando el enlace…</p> : !token ? <><p>El enlace no es válido o ya venció. Solicita uno nuevo al administrador.</p><Link className="btn btn-secondary" to="/ingresar">Ir al inicio de sesión</Link></> : saved ? <><p>Ya puedes ingresar con tu nueva contraseña.</p><Button type="button" onClick={() => navigate('/inicio')}>Continuar</Button></> : <>
      <p>Elige una contraseña de al menos 8 caracteres.</p>
      <TextField label="Nueva contraseña" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPasswordValue(e.target.value)} />
      <TextField label="Confirmar contraseña" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
      {error && <ErrorNotice message={error} />}
      <Button type="submit" disabled={saving || password.length < 8 || confirmation.length < 8}>{saving ? 'Guardando…' : 'Guardar contraseña'}</Button>
    </>}
  </form></div></div>
}
