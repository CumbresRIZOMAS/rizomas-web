import { useState, type FormEvent } from 'react'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { AppUser, Role } from '../../shared/api/types'
import { initials, ROLE_LABEL } from '../../shared/format'
import { Button, Card, Chip, Empty, ErrorNotice, FormCard, Icon, Loading, PageHeader, SelectField, TextField } from '../../shared/ui'

/** Roles que inician sesión (Proveedor y Trabajador son entidades externas, no usuarios). */
const ROLES_ASIGNABLES: Role[] = ['ADMIN_CUMBRES', 'ADMIN_FINCA', 'TECNICO', 'AGRICULTOR', 'CLIENTE']

/** Gestión de usuarios y roles (RF-01). */
export function UsuariosPage() {
  const { data, error, loading, reload } = useApiQuery<AppUser[]>('/users')
  const { mutate, error: errorEstado } = useApiMutation()
  const [q, setQ] = useState('')
  const [rol, setRol] = useState<Role | ''>('')
  const [invitando, setInvitando] = useState(false)

  const texto = q.trim().toLowerCase()
  const visibles = (data ?? []).filter((u) => (!texto || `${u.name} ${u.email}`.toLowerCase().includes(texto)) && (!rol || u.role === rol))

  async function cambiarEstado(u: AppUser) {
    if (u.active && !window.confirm(`¿Desactivar a ${u.name}? No podrá volver a ingresar hasta que se reactive.`)) return
    if ((await mutate(`/users/${u.id}/status`, 'PATCH', { active: !u.active })) !== null) reload()
  }

  return (
    <div>
      <PageHeader
        eyebrow="Solo administradores"
        title="Gestión de usuarios"
        subtitle="Administra accesos y roles."
        actions={
          !invitando && (
            <Button icon="plus" onClick={() => setInvitando(true)}>
              Registrar usuario
            </Button>
          )
        }
      />
      <div className="stack">
        {invitando && (
          <UsuarioForm
            onCancel={() => setInvitando(false)}
            onSaved={() => {
              setInvitando(false)
              reload()
            }}
          />
        )}
        {errorEstado && <ErrorNotice message={errorEstado} />}
        <Card>
          <div className="filter-bar">
            <div className="search-field">
              <Icon name="search" />
              <input aria-label="Buscar usuario" placeholder="Buscar por nombre o correo" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <label className="field">
              <select aria-label="Rol" value={rol} onChange={(e) => setRol(e.target.value as Role | '')}>
                <option value="">Todos los roles</option>
                {ROLES_ASIGNABLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {loading && !data && <Loading />}
          {error && <ErrorNotice message={error} onRetry={reload} />}
          {data && visibles.length === 0 && <Empty title="Ningún usuario coincide" />}
          {visibles.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <span className="user-cell">
                          <i>{initials(u.name)}</i>
                          <strong>{u.name}</strong>
                        </span>
                      </td>
                      <td>{u.email}</td>
                      <td>{ROLE_LABEL[u.role] ?? u.role}</td>
                      <td>
                        <Chip tone={u.active ? 'green' : 'gray'}>{u.active ? 'Activo' : 'Inactivo'}</Chip>
                      </td>
                      <td>
                        <Button variant="ghost" onClick={() => void cambiarEstado(u)}>
                          {u.active ? 'Desactivar' : 'Activar'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function UsuarioForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { mutate, saving, error } = useApiMutation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('AGRICULTOR')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (await mutate('/users', 'POST', { name: name.trim(), email: email.trim(), role })) onSaved()
  }

  return (
    <FormCard title="Registrar usuario">
      <form onSubmit={onSubmit}>
        <div className="form-grid three">
          <TextField label="Nombre completo *" required value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="Correo electrónico *" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <SelectField label="Rol *" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES_ASIGNABLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </SelectField>
        </div>
        <p className="muted" style={{ fontSize: 9 }}>
          El usuario inicia sesión con este correo en Supabase Auth; su rol se toma de este registro.
        </p>
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" icon="check" disabled={saving || !name.trim() || !email.trim()}>
            {saving ? 'Guardando…' : 'Guardar usuario'}
          </Button>
        </div>
      </form>
    </FormCard>
  )
}
