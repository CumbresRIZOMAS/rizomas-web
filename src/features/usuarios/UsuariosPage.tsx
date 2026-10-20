import { useState, type FormEvent } from 'react'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { AppUser, Farm, Role } from '../../shared/api/types'
import { canDo, ROLES, useAuth } from '../../shared/auth/context'
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
  const [invitando, setInvitando] = useState(false)
  const [editando, setEditando] = useState<AppUser | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const roles = role === 'ADMIN_CUMBRES' ? ROLES_CUMBRES : ROLES_FINCA
  const texto = q.trim().toLowerCase()
  const visibles = (data ?? []).filter((u) => (!texto || `${u.name} ${u.email}`.toLowerCase().includes(texto)) && (!rol || u.role === rol))

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
      <PageHeader eyebrow="Solo administradores" title="Gestión de usuarios" subtitle="Invita personas, administra roles y controla el acceso a las fincas." actions={!invitando && <Button icon="plus" onClick={() => setInvitando(true)}>Invitar usuario</Button>} />
      <div className="stack">
        {invitando && <UsuarioForm farms={farms} roles={roles} roleActor={role} onCancel={() => setInvitando(false)} onSaved={() => { setInvitando(false); reload(); setMensaje('Invitación enviada por correo desde Supabase.') }} />}
        {editando && <EditarUsuarioForm user={editando} roles={roles} onCancel={() => setEditando(null)} onSaved={() => { setEditando(null); reload() }} />}
        {mensaje && <div className="notice notice-success" role="status">{mensaje}<button type="button" onClick={() => setMensaje(null)} aria-label="Cerrar">×</button></div>}
        {actions.error && <ErrorNotice message={actions.error} />}
        <Card>
          <div className="filter-bar">
            <div className="search-field"><Icon name="search" /><input aria-label="Buscar usuario" placeholder="Buscar por nombre o correo" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <label className="field"><select aria-label="Rol" value={rol} onChange={(e) => setRol(e.target.value as Role | '')}><option value="">Todos los roles</option>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}</select></label>
          </div>
          {loading && !data && <Loading />}
          {error && <ErrorNotice message={error} onRetry={reload} />}
          {data && visibles.length === 0 && <Empty title="Ningún usuario coincide" />}
          {visibles.length > 0 && <div className="table-wrap"><table><thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
            {visibles.map((u) => <tr key={u.id}>
              <td><span className="user-cell"><i>{initials(u.name)}</i><strong>{u.name}</strong></span></td><td>{u.email}</td><td>{ROLE_LABEL[u.role] ?? u.role}</td>
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
  const [role, setRole] = useState<Role>(roleActor === 'ADMIN_CUMBRES' ? 'ADMIN_FINCA' : 'AGRICULTOR')
  const [farmId, setFarmId] = useState(roleActor === 'ADMIN_CUMBRES' ? '' : farms[0]?.id ?? '')
  const requiereFinca = ['ADMIN_FINCA', 'TECNICO', 'AGRICULTOR'].includes(role)
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (await mutate('/users', 'POST', { name: name.trim(), email: email.trim(), role, farmId: farmId || undefined })) onSaved()
  }
  return <FormCard title="Invitar usuario"><form onSubmit={onSubmit}>
    <div className="form-grid three"><TextField label="Nombre completo *" required value={name} onChange={(e) => setName(e.target.value)} /><TextField label="Correo electrónico *" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /><SelectField label="Rol *" value={role} onChange={(e) => setRole(e.target.value as Role)}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}</SelectField></div>
    <div className="form-grid"><SelectField label={requiereFinca ? 'Finca *' : 'Finca (opcional)'} value={farmId} onChange={(e) => setFarmId(e.target.value)}><option value="">{requiereFinca ? 'Selecciona una finca' : 'Sin finca asignada'}</option>{farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</SelectField></div>
    <p className="muted" style={{ fontSize: 9 }}>Se creará la cuenta en Supabase y la persona recibirá un correo para configurar su contraseña. Los administradores de finca solo pueden invitar roles distintos a Administrador de Cumbres Sacras.</p>
    {error && <ErrorNotice message={error} />}
    <div className="form-actions"><Button variant="ghost" onClick={onCancel}>Cancelar</Button><Button type="submit" icon="check" disabled={saving || !name.trim() || !email.trim() || (requiereFinca && !farmId)}>{saving ? 'Enviando…' : 'Enviar invitación'}</Button></div>
  </form></FormCard>
}

function EditarUsuarioForm({ user, roles, onSaved, onCancel }: { user: AppUser; roles: Role[]; onSaved: () => void; onCancel: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState<Role>(user.role)
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (await mutate(`/users/${user.id}`, 'PATCH', { name: name.trim(), email: email.trim(), role })) onSaved()
  }
  return <FormCard title={`Editar usuario · ${user.name}`}><form onSubmit={onSubmit}>
    <div className="form-grid three"><TextField label="Nombre completo *" required value={name} onChange={(e) => setName(e.target.value)} /><TextField label="Correo electrónico *" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /><SelectField label="Rol *" value={role} onChange={(e) => setRole(e.target.value as Role)}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}</SelectField></div>
    <p className="muted" style={{ fontSize: 9 }}>El cambio de correo se aplica también a Supabase Auth. El nuevo rol se valida en el backend.</p>
    {error && <ErrorNotice message={error} />}
    <div className="form-actions"><Button variant="ghost" onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={saving || !name.trim() || !email.trim()}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button></div>
  </form></FormCard>
}
