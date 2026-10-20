import { useState, type FormEvent } from 'react'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { AppUser, Farm, Role } from '../../shared/api/types'
import { useAuth } from '../../shared/auth/context'
import { useActiveFarm } from '../../shared/farm/context'
import { initials, ROLE_LABEL } from '../../shared/format'
import { Button, Card, Chip, Empty, ErrorNotice, FormCard, Icon, Loading, PageHeader, SelectField, TextField } from '../../shared/ui'

const ROLES_CUMBRES: Role[] = ['ADMIN_CUMBRES', 'ADMIN_FINCA', 'TECNICO', 'AGRICULTOR', 'CLIENTE', 'PROVEEDOR', 'COMPRADOR_CERTIFICADORA', 'PUBLICO']
const ROLES_FINCA: Role[] = ROLES_CUMBRES.filter((r) => r !== 'ADMIN_CUMBRES')

export function UsuariosPage() {
  const { role, email: emailActor } = useAuth()
  const { farms } = useActiveFarm()
  const { data, error, loading, reload } = useApiQuery<AppUser[]>('/users')
  const actions = useApiMutation()
  const [q, setQ] = useState('')
  const [rol, setRol] = useState<Role | ''>('')
  const [fincaId, setFincaId] = useState('')
  const [invitando, setInvitando] = useState(false)
  const [editando, setEditando] = useState<AppUser | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const roles = role === 'ADMIN_CUMBRES' ? ROLES_CUMBRES : ROLES_FINCA
  const texto = q.trim().toLowerCase()
  const fincasDe = (u: AppUser) => {
    const asignadas = [...(u.farmMembers ?? []).map((m) => m.farm), ...(u.ownedFarms ?? [])]
    return [...new Map(asignadas.map((f) => [f.id, f])).values()]
  }
  const visibles = (data ?? []).filter((u) => {
    const fincasUsuario = fincasDe(u)
    const busqueda = `${u.name} ${u.email} ${fincasUsuario.map((f) => f.name).join(' ')}`.toLowerCase()
    return (!texto || busqueda.includes(texto)) && (!rol || u.role === rol) && (!fincaId || fincasUsuario.some((f) => f.id === fincaId))
  })

  async function cambiarEstado(u: AppUser) {
    if (u.active && !window.confirm(`¿Desactivar a ${u.name}? Se bloqueará su acceso.`)) return
    if ((await actions.mutate(`/users/${u.id}/status`, 'PATCH', { active: !u.active })) !== null) reload()
  }

  async function restablecer(u: AppUser) {
    if (!window.confirm(`¿Enviar a ${u.email} un enlace para cambiar su contraseña?`)) return
    if (await actions.mutate(`/users/${u.id}/password-reset`, 'POST')) setMensaje(`Enlace de restablecimiento enviado a ${u.email}.`)
  }

  async function eliminar(u: AppUser) {
    if (!window.confirm(`¿Eliminar permanentemente a ${u.name} (${u.email})? Si es propietario de fincas, pasarán a tu usuario administrador. Esta acción no se puede deshacer.`)) return
    const result = await actions.mutate<{ farmsTransferred: number }>(`/users/${u.id}`, 'DELETE')
    if (result) { setMensaje(`Se eliminó a ${u.name}.${result.farmsTransferred ? ` ${result.farmsTransferred} finca(s) se transfirieron a tu usuario.` : ''}`); reload() }
  }

  return (
    <div>
      <PageHeader eyebrow="Solo administradores" title="Gestión de usuarios" subtitle="Crea cuentas para la web y la app móvil, administra roles y controla el acceso a las fincas." actions={!invitando && <Button icon="plus" onClick={() => setInvitando(true)}>Crear usuario</Button>} />
      <div className="stack">
        {invitando && <UsuarioForm farms={farms} roles={roles} roleActor={role} onCancel={() => setInvitando(false)} onSaved={() => { setInvitando(false); reload(); setMensaje('Cuenta creada en Supabase. Comparte la contraseña inicial por un canal seguro; la persona ya puede ingresar desde la app móvil.') }} />}
        {editando && <EditarUsuarioForm user={editando} farms={farms} roles={roles} onCancel={() => setEditando(null)} onSaved={() => { setEditando(null); reload() }} />}
        {mensaje && <div className="notice notice-success" role="status">{mensaje}<button type="button" onClick={() => setMensaje(null)} aria-label="Cerrar">×</button></div>}
        {actions.error && <ErrorNotice message={actions.error} />}
        <Card>
          <div className="filter-bar">
            <div className="search-field"><Icon name="search" /><input aria-label="Buscar usuario" placeholder="Buscar por nombre, correo o finca" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <label className="field"><select aria-label="Finca" value={fincaId} onChange={(e) => setFincaId(e.target.value)}><option value="">{role === 'ADMIN_CUMBRES' ? 'Todas las fincas' : 'Todas mis fincas'}</option>{farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
            <label className="field"><select aria-label="Rol" value={rol} onChange={(e) => setRol(e.target.value as Role | '')}><option value="">Todos los roles</option>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}</select></label>
          </div>
          {loading && !data && <Loading />}
          {error && <ErrorNotice message={error} onRetry={reload} />}
          {data && visibles.length === 0 && <Empty title="Ningún usuario coincide" />}
          {visibles.length > 0 && <div className="table-wrap"><table><thead><tr><th>Usuario</th><th>Correo</th><th>Finca(s)</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
            {visibles.map((u) => <tr key={u.id}>
              <td><span className="user-cell"><i>{initials(u.name)}</i><strong>{u.name}</strong></span></td><td>{u.email}</td><td>{fincasDe(u).map((f) => f.name).join(', ') || '—'}</td><td>{ROLE_LABEL[u.role] ?? u.role}</td>
              <td><Chip tone={u.active ? 'green' : 'gray'}>{u.active ? 'Activo' : 'Inactivo'}</Chip></td>
              <td><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <Button variant="ghost" onClick={() => setEditando(u)}>Editar</Button>
                <Button variant="ghost" onClick={() => void restablecer(u)}>Restablecer contraseña</Button>
                <Button variant="ghost" onClick={() => void cambiarEstado(u)}>{u.active ? 'Desactivar' : 'Activar'}</Button>
                {u.email !== emailActor && <Button variant="danger" onClick={() => void eliminar(u)}>Eliminar</Button>}
              </div></td>
            </tr>)}
          </tbody></table></div>}
        </Card>
      </div>
    </div>
  )
}

function UsuarioForm({ farms, roles, roleActor, onSaved, onCancel }: { farms: Farm[]; roles: Role[]; roleActor: Role | null; onSaved: () => void; onCancel: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [role, setRole] = useState<Role>(roleActor === 'ADMIN_CUMBRES' ? 'ADMIN_FINCA' : 'AGRICULTOR')
  const [farmIds, setFarmIds] = useState<string[]>(roleActor === 'ADMIN_CUMBRES' ? [] : farms.length === 1 ? [farms[0].id] : [])
  const requiereFinca = ['ADMIN_FINCA', 'TECNICO', 'AGRICULTOR'].includes(role)
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== passwordConfirmation) {
      setPasswordError('Las contraseñas no coinciden.')
      return
    }
    setPasswordError(null)
    if (await mutate('/users', 'POST', { name: name.trim(), email: email.trim(), role, farmIds, password })) onSaved()
  }
  return <FormCard title="Crear usuario"><form onSubmit={onSubmit}>
    <div className="form-grid three"><TextField label="Nombre completo *" required value={name} onChange={(e) => setName(e.target.value)} /><TextField label="Correo electrónico *" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /><SelectField label="Rol *" value={role} onChange={(e) => setRole(e.target.value as Role)}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}</SelectField><TextField label="Contraseña inicial *" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint="Mínimo 8 caracteres. La persona podrá cambiarla después." /><TextField label="Confirmar contraseña *" type="password" required minLength={8} autoComplete="new-password" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} /></div>
    <div className="form-grid"><label className="field"><span>{requiereFinca ? 'Fincas *' : 'Fincas (opcional)'}</span><select aria-label="Fincas" multiple size={Math.min(Math.max(farms.length, 2), 5)} value={farmIds} onChange={(e) => setFarmIds(Array.from(e.currentTarget.selectedOptions, (option) => option.value))}>{farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select><small>Selecciona una o varias fincas. En computador, usa Ctrl o Cmd para elegir más de una.</small></label></div>
    <p className="muted" style={{ fontSize: 9 }}>La cuenta se creará en Supabase con esta contraseña para que pueda entrar a la web y a la app móvil. No se enviará por correo; compártela por un canal seguro. Solo puedes asignar fincas que aparecen en esta lista.</p>
    {passwordError && <ErrorNotice message={passwordError} />}
    {error && <ErrorNotice message={error} />}
    <div className="form-actions"><Button variant="ghost" onClick={onCancel}>Cancelar</Button><Button type="submit" icon="check" disabled={saving || !name.trim() || !email.trim() || password.length < 8 || !passwordConfirmation || (requiereFinca && farmIds.length === 0)}>{saving ? 'Creando…' : 'Crear cuenta'}</Button></div>
  </form></FormCard>
}

function EditarUsuarioForm({ user, farms, roles, onSaved, onCancel }: { user: AppUser; farms: Farm[]; roles: Role[]; onSaved: () => void; onCancel: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState<Role>(user.role)
  const [farmIds, setFarmIds] = useState<string[]>([...(user.farmMembers ?? []).map((m) => m.farm.id), ...(user.ownedFarms ?? []).map((f) => f.id)])
  const requiereFinca = ['ADMIN_FINCA', 'TECNICO', 'AGRICULTOR'].includes(role)
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (await mutate(`/users/${user.id}`, 'PATCH', { name: name.trim(), email: email.trim(), role, farmIds })) onSaved()
  }
  return <FormCard title={`Editar usuario · ${user.name}`}><form onSubmit={onSubmit}>
    <div className="form-grid three"><TextField label="Nombre completo *" required value={name} onChange={(e) => setName(e.target.value)} /><TextField label="Correo electrónico *" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /><SelectField label="Rol *" value={role} onChange={(e) => setRole(e.target.value as Role)}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}</SelectField></div>
    <div className="form-grid"><label className="field"><span>{requiereFinca ? 'Fincas *' : 'Fincas (opcional)'}</span><select aria-label="Fincas asignadas" multiple size={Math.min(Math.max(farms.length, 2), 5)} value={farmIds} onChange={(e) => setFarmIds(Array.from(e.currentTarget.selectedOptions, (option) => option.value))}>{farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select><small>Solo puedes modificar las fincas a las que tienes acceso.</small></label></div>
    <p className="muted" style={{ fontSize: 9 }}>El cambio de correo se aplica también a Supabase Auth. El nuevo rol se valida en el backend.</p>
    {error && <ErrorNotice message={error} />}
    <div className="form-actions"><Button variant="ghost" onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={saving || !name.trim() || !email.trim() || (requiereFinca && farmIds.length === 0)}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button></div>
  </form></FormCard>
}
