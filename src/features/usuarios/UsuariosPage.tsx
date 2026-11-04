import { useState, type FormEvent } from 'react'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { AppUser, Farm, Lot, Role } from '../../shared/api/types'
import { useAuth } from '../../shared/auth/context'
import { useActiveFarm } from '../../shared/farm/context'
import { initials, ROLE_LABEL } from '../../shared/format'
import { localPhoneDisplay, localPhoneInput } from '../../shared/auth/phone'
import { Button, Card, Chip, Empty, ErrorNotice, FormCard, Icon, Loading, PageHeader, SelectField, TextField } from '../../shared/ui'

const ROLES_CUMBRES: Role[] = ['ADMIN_CUMBRES', 'ADMIN_FINCA', 'TECNICO', 'AGRICULTOR', 'CLIENTE', 'PROVEEDOR', 'COMPRADOR_CERTIFICADORA', 'PUBLICO']
const ROLES_FINCA: Role[] = ROLES_CUMBRES.filter((r) => r !== 'ADMIN_CUMBRES')

export function UsuariosPage() {
  const { role, userId } = useAuth()
  const { farms } = useActiveFarm()
  const { data, error, loading, reload } = useApiQuery<AppUser[]>('/users')
  const { data: lotsData } = useApiQuery<Lot[]>('/lots')
  const lots = lotsData ?? []
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
    const busqueda = `${u.name} ${u.email ?? ''} ${u.phone ?? ''} ${localPhoneDisplay(u.phone)} ${u.documentNumber ?? ''} ${u.associationName ?? ''} ${fincasUsuario.map((f) => f.name).join(' ')} ${(u.lotMembers ?? []).map((m) => m.lot.name).join(' ')}`.toLowerCase()
    return (!texto || busqueda.includes(texto)) && (!rol || u.role === rol) && (!fincaId || fincasUsuario.some((f) => f.id === fincaId))
  })

  async function cambiarEstado(u: AppUser) {
    if (u.active && !window.confirm(`¿Desactivar a ${u.name}? Se bloqueará su acceso.`)) return
    if ((await actions.mutate(`/users/${u.id}/status`, 'PATCH', { active: !u.active })) !== null) reload()
  }

  async function restablecer(u: AppUser) {
    const destino = u.email || localPhoneDisplay(u.phone) || u.name
    if (!window.confirm(u.email ? `¿Enviar a ${destino} un enlace para cambiar su contraseña?` : `¿Generar una contraseña temporal para ${destino}?`)) return
    const result = await actions.mutate<{ sent: boolean; temporaryPassword?: string }>(`/users/${u.id}/password-reset`, 'POST')
    if (result?.temporaryPassword) setMensaje(`Contraseña temporal de ${u.name}: ${result.temporaryPassword}. Compártela por un canal seguro.`)
    else if (result?.sent) setMensaje(`Enlace de restablecimiento enviado a ${destino}.`)
  }

  async function eliminar(u: AppUser) {
    if (!window.confirm(`¿Eliminar permanentemente a ${u.name} (${u.email || localPhoneDisplay(u.phone) || 'sin contacto'})? Si es propietario de fincas, pasarán a tu usuario administrador. Esta acción no se puede deshacer.`)) return
    const result = await actions.mutate<{ farmsTransferred: number }>(`/users/${u.id}`, 'DELETE')
    if (result) { setMensaje(`Se eliminó a ${u.name}.${result.farmsTransferred ? ` ${result.farmsTransferred} finca(s) se transfirieron a tu usuario.` : ''}`); reload() }
  }

  return (
    <div>
      <PageHeader eyebrow="Solo administradores" title="Gestión de usuarios" subtitle="Crea cuentas para la web y la app móvil, administra roles y controla el acceso a las fincas." actions={!invitando && <div style={{ display: 'flex', gap: 8 }}><Button variant="ghost" onClick={reload}>Actualizar lista</Button><Button icon="plus" onClick={() => setInvitando(true)}>Crear usuario</Button></div>} />
      <div className="stack">
        {invitando && <UsuarioForm farms={farms} lots={lots} roles={roles} roleActor={role} onCancel={() => setInvitando(false)} onSaved={() => { setInvitando(false); reload(); setMensaje('Cuenta creada en Supabase. Comparte la contraseña inicial por un canal seguro; la persona ya puede ingresar desde la app móvil.') }} />}
        {editando && <EditarUsuarioForm user={editando} farms={farms} lots={lots} roles={roles} onCancel={() => setEditando(null)} onSaved={() => { setEditando(null); reload() }} />}
        {mensaje && <div className="notice notice-success" role="status">{mensaje}<button type="button" onClick={() => setMensaje(null)} aria-label="Cerrar">×</button></div>}
        {actions.error && <ErrorNotice message={actions.error} />}
        <Card>
          <div className="filter-bar">
            <div className="search-field"><Icon name="search" /><input aria-label="Buscar usuario" placeholder="Buscar por nombre, correo, celular o finca" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <label className="field"><select aria-label="Finca" value={fincaId} onChange={(e) => setFincaId(e.target.value)}><option value="">{role === 'ADMIN_CUMBRES' ? 'Todas las fincas' : 'Todas mis fincas'}</option>{farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
            <label className="field"><select aria-label="Rol" value={rol} onChange={(e) => setRol(e.target.value as Role | '')}><option value="">Todos los roles</option>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}</select></label>
          </div>
          {loading && !data && <Loading />}
          {error && <ErrorNotice message={error} onRetry={reload} />}
          {data && visibles.length === 0 && <Empty title="Ningún usuario coincide" />}
          {visibles.length > 0 && <div className="table-wrap"><table><thead><tr><th>Usuario</th><th>Correo / celular</th><th>Finca(s)</th><th>Lote(s)</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
            {visibles.map((u) => <tr key={u.id}>
              <td><span className="user-cell"><i>{initials(u.name)}</i><strong>{u.name}</strong></span></td><td>{u.email || localPhoneDisplay(u.phone) || 'Sin acceso'}</td><td>{fincasDe(u).map((f) => f.name).join(', ') || '—'}</td><td>{(u.lotMembers ?? []).map((m) => m.lot.name).join(', ') || '—'}</td><td>{ROLE_LABEL[u.role] ?? u.role}</td>
              <td><Chip tone={u.active ? 'green' : 'gray'}>{!u.authUserId ? 'Pendiente de acceso' : u.active ? 'Activo' : 'Inactivo'}</Chip></td>
              <td><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <Button variant="ghost" onClick={() => setEditando(u)}>Editar</Button>
                <Button variant="ghost" disabled={!u.authUserId} onClick={() => void restablecer(u)}>Restablecer contraseña</Button>
                <Button variant="ghost" onClick={() => void cambiarEstado(u)}>{u.active ? 'Desactivar' : 'Activar'}</Button>
                {u.authUserId !== userId && <Button variant="danger" onClick={() => void eliminar(u)}>Eliminar</Button>}
              </div></td>
            </tr>)}
          </tbody></table></div>}
        </Card>
      </div>
    </div>
  )
}

function UsuarioForm({ farms, lots, roles, roleActor, onSaved, onCancel }: { farms: Farm[]; lots: Lot[]; roles: Role[]; roleActor: Role | null; onSaved: () => void; onCancel: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [associationCode, setAssociationCode] = useState('')
  const [associationName, setAssociationName] = useState('')
  const [secondLevelGroup, setSecondLevelGroup] = useState('')
  const [sex, setSex] = useState('')
  const [age, setAge] = useState('')
  const [specialGroup, setSpecialGroup] = useState('')
  const [educationLevel, setEducationLevel] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [contactError, setContactError] = useState<string | null>(null)
  const [role, setRole] = useState<Role>(roleActor === 'ADMIN_CUMBRES' ? 'ADMIN_FINCA' : 'AGRICULTOR')
  const [farmIds, setFarmIds] = useState<string[]>(roleActor === 'ADMIN_CUMBRES' ? [] : farms.length === 1 ? [farms[0].id] : [])
  const [lotIds, setLotIds] = useState<string[]>([])
  const lotsForFarms = lots.filter((lot) => farmIds.includes(lot.farmId))
  const requiereFinca = ['ADMIN_FINCA', 'TECNICO', 'AGRICULTOR'].includes(role)
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() && !phone.trim()) {
      setContactError('Registra un correo electrónico, un celular o ambos para crear el acceso.')
      return
    }
    setContactError(null)
    if (password !== passwordConfirmation) {
      setPasswordError('Las contraseñas no coinciden.')
      return
    }
    setPasswordError(null)
    if (await mutate('/users', 'POST', {
      name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined, role, farmIds, lotIds, password,
      documentNumber: documentNumber.trim() || undefined,
      associationCode: associationCode.trim() || undefined,
      associationName: associationName.trim() || undefined,
      secondLevelGroup: secondLevelGroup.trim() || undefined,
      sex: sex || undefined,
      age: age ? Number(age) : undefined,
      specialGroup: specialGroup.trim() || undefined,
      educationLevel: educationLevel.trim() || undefined,
    })) onSaved()
  }
  return <FormCard title="Crear usuario"><form onSubmit={onSubmit}>
    <div className="form-grid three">
      <TextField label="Nombre completo *" required value={name} onChange={(e) => setName(e.target.value)} />
      <TextField label="Correo electrónico" type="email" optional value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextField label="Celular" optional value={phone} onChange={(e) => setPhone(localPhoneInput(e.target.value))} hint="Escribe los 10 dígitos, sin +57." />
      <SelectField label="Rol *" value={role} onChange={(e) => setRole(e.target.value as Role)}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}</SelectField>
      <TextField label="Contraseña inicial *" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint="Mínimo 8 caracteres. La persona podrá cambiarla después." />
      <TextField label="Confirmar contraseña *" type="password" required minLength={8} autoComplete="new-password" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} />
    </div>
    <p className="muted" style={{ fontSize: 10 }}>Registra correo, celular o ambos; al menos uno es obligatorio. Cada dato que ingreses se guardará también en Supabase Auth.</p>
    <h3>Datos del registro</h3>
    <div className="form-grid three">
      <TextField label="Documento de identidad" optional value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
      <TextField label="Código de asociación" optional value={associationCode} onChange={(e) => setAssociationCode(e.target.value)} />
      <TextField label="Asociación o grupo" optional value={associationName} onChange={(e) => setAssociationName(e.target.value)} />
      <TextField label="Grupo asociativo de segundo nivel" optional value={secondLevelGroup} onChange={(e) => setSecondLevelGroup(e.target.value)} />
      <SelectField label="Sexo" optional value={sex} onChange={(e) => setSex(e.target.value)}><option value="">Sin especificar</option><option value="F">Femenino</option><option value="M">Masculino</option><option value="OTRO">Otro</option></SelectField>
      <TextField label="Edad" type="number" optional min="0" max="130" value={age} onChange={(e) => setAge(e.target.value)} />
      <TextField label="Grupo especial" optional value={specialGroup} onChange={(e) => setSpecialGroup(e.target.value)} />
      <TextField label="Escolaridad" optional value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)} />
    </div>
    <div className="form-grid"><label className="field"><span>{requiereFinca ? 'Fincas *' : 'Fincas (opcional)'}</span><select aria-label="Fincas" multiple size={Math.min(Math.max(farms.length, 2), 5)} value={farmIds} onChange={(e) => { const next = Array.from(e.currentTarget.selectedOptions, (option) => option.value); setFarmIds(next); setLotIds((current) => current.filter((id) => lots.some((lot) => lot.id === id && next.includes(lot.farmId)))) }}>{farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select><small>Selecciona una o varias fincas. En computador, usa Ctrl o Cmd para elegir más de una.</small></label><label className="field"><span>Lotes asignados (opcional)</span><select aria-label="Lotes asignados" multiple size={Math.min(Math.max(lotsForFarms.length, 2), 5)} value={lotIds} onChange={(e) => setLotIds(Array.from(e.currentTarget.selectedOptions, (option) => option.value))}>{lotsForFarms.map((lot) => <option key={lot.id} value={lot.id}>{lot.name} · {farms.find((farm) => farm.id === lot.farmId)?.name}</option>)}</select><small>Solo se muestran lotes de las fincas elegidas.</small></label></div>
    <p className="muted" style={{ fontSize: 9 }}>La cuenta se creará en Supabase Auth con el correo, el celular o ambos datos registrados. Podrá iniciar sesión con cualquiera de los identificadores y esta contraseña en la web y la app móvil. Comparte la contraseña por un canal seguro.</p>
    {contactError && <ErrorNotice message={contactError} />}
    {passwordError && <ErrorNotice message={passwordError} />}
    {error && <ErrorNotice message={error} />}
    <div className="form-actions"><Button variant="ghost" onClick={onCancel}>Cancelar</Button><Button type="submit" icon="check" disabled={saving || !name.trim() || password.length < 8 || !passwordConfirmation || (requiereFinca && farmIds.length === 0)}>{saving ? 'Creando…' : 'Crear cuenta'}</Button></div>
  </form></FormCard>
}

function EditarUsuarioForm({ user, farms, lots, roles, onSaved, onCancel }: { user: AppUser; farms: Farm[]; lots: Lot[]; roles: Role[]; onSaved: () => void; onCancel: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [phone, setPhone] = useState(localPhoneDisplay(user.phone))
  const [documentNumber, setDocumentNumber] = useState(user.documentNumber ?? '')
  const [associationCode, setAssociationCode] = useState(user.associationCode ?? '')
  const [associationName, setAssociationName] = useState(user.associationName ?? '')
  const [secondLevelGroup, setSecondLevelGroup] = useState(user.secondLevelGroup ?? '')
  const [sex, setSex] = useState(user.sex ?? '')
  const [age, setAge] = useState(user.age?.toString() ?? '')
  const [specialGroup, setSpecialGroup] = useState(user.specialGroup ?? '')
  const [educationLevel, setEducationLevel] = useState(user.educationLevel ?? '')
  const [role, setRole] = useState<Role>(user.role)
  const [farmIds, setFarmIds] = useState<string[]>([...(user.farmMembers ?? []).map((m) => m.farm.id), ...(user.ownedFarms ?? []).map((f) => f.id)])
  const [lotIds, setLotIds] = useState<string[]>((user.lotMembers ?? []).map((m) => m.lot.id))
  const lotsForFarms = lots.filter((lot) => farmIds.includes(lot.farmId))
  const requiereFinca = ['ADMIN_FINCA', 'TECNICO', 'AGRICULTOR'].includes(role)
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (await mutate(`/users/${user.id}`, 'PATCH', {
      name: name.trim(), email: email?.trim() || undefined, phone: phone.trim() || undefined, role, farmIds, lotIds,
      documentNumber: documentNumber.trim() || undefined,
      associationCode: associationCode.trim() || undefined,
      associationName: associationName.trim() || undefined,
      secondLevelGroup: secondLevelGroup.trim() || undefined,
      sex: sex || undefined,
      age: age ? Number(age) : undefined,
      specialGroup: specialGroup.trim() || undefined,
      educationLevel: educationLevel.trim() || undefined,
    })) onSaved()
  }
  return <FormCard title={`Editar usuario · ${user.name}`}><form onSubmit={onSubmit}>
    <div className="form-grid three">
      <TextField label="Nombre completo *" required value={name} onChange={(e) => setName(e.target.value)} />
      <TextField label="Correo electrónico" type="email" optional value={email ?? ''} onChange={(e) => setEmail(e.target.value)} />
      <TextField label="Celular" optional value={phone} onChange={(e) => setPhone(localPhoneInput(e.target.value))} hint="Escribe los 10 dígitos, sin +57." />
      <SelectField label="Rol *" value={role} onChange={(e) => setRole(e.target.value as Role)}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}</SelectField>
      <TextField label="Documento de identidad" optional value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
      <TextField label="Código de asociación" optional value={associationCode} onChange={(e) => setAssociationCode(e.target.value)} />
      <TextField label="Asociación o grupo" optional value={associationName} onChange={(e) => setAssociationName(e.target.value)} />
      <TextField label="Grupo asociativo de segundo nivel" optional value={secondLevelGroup} onChange={(e) => setSecondLevelGroup(e.target.value)} />
      <SelectField label="Sexo" optional value={sex} onChange={(e) => setSex(e.target.value)}><option value="">Sin especificar</option><option value="F">Femenino</option><option value="M">Masculino</option><option value="OTRO">Otro</option></SelectField>
      <TextField label="Edad" type="number" optional min="0" max="130" value={age} onChange={(e) => setAge(e.target.value)} />
      <TextField label="Grupo especial" optional value={specialGroup} onChange={(e) => setSpecialGroup(e.target.value)} />
      <TextField label="Escolaridad" optional value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)} />
    </div>
    <div className="form-grid"><label className="field"><span>{requiereFinca ? 'Fincas *' : 'Fincas (opcional)'}</span><select aria-label="Fincas asignadas" multiple size={Math.min(Math.max(farms.length, 2), 5)} value={farmIds} onChange={(e) => { const next = Array.from(e.currentTarget.selectedOptions, (option) => option.value); setFarmIds(next); setLotIds((current) => current.filter((id) => lots.some((lot) => lot.id === id && next.includes(lot.farmId)))) }}>{farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select><small>Solo puedes modificar las fincas a las que tienes acceso.</small></label><label className="field"><span>Lotes asignados (opcional)</span><select aria-label="Lotes asignados" multiple size={Math.min(Math.max(lotsForFarms.length, 2), 5)} value={lotIds} onChange={(e) => setLotIds(Array.from(e.currentTarget.selectedOptions, (option) => option.value))}>{lotsForFarms.map((lot) => <option key={lot.id} value={lot.id}>{lot.name} · {farms.find((farm) => farm.id === lot.farmId)?.name}</option>)}</select><small>Solo se muestran lotes de las fincas elegidas.</small></label></div>
    <p className="muted" style={{ fontSize: 9 }}>Si el usuario inicia con correo, el cambio se aplica en Supabase Auth. En cuentas de celular, el celular es su identificador de acceso.</p>
    {error && <ErrorNotice message={error} />}
    <div className="form-actions"><Button variant="ghost" onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={saving || !name.trim() || (!(email ?? '').trim() && !phone.trim()) || (requiereFinca && farmIds.length === 0)}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button></div>
  </form></FormCard>
}
