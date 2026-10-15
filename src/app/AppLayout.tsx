import { NavLink, Outlet } from 'react-router'
import { canDo, ROLES, useAuth } from '../shared/auth/context'

const ROLE_LABEL: Record<string, string> = {
  ADMIN_CUMBRES: 'Administración Cumbres',
  ADMIN_FINCA: 'Administración de finca',
  TECNICO: 'Técnico',
  AGRICULTOR: 'Agricultor',
}

export function AppLayout() {
  const { email, role, signOut } = useAuth()
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span aria-hidden="true">🌿</span>
          <div>
            RIZOMAS
            <small>Panel técnico</small>
          </div>
        </div>
        <nav className="nav" aria-label="Principal">
          <NavLink to="/fincas">Fincas</NavLink>
          {canDo(role, ROLES.verRangosSuelo) && <NavLink to="/suelos/rangos">Rangos de suelo</NavLink>}
        </nav>
        <div className="sidebar-footer">
          <div>
            <div>{email}</div>
            {role && <div className="meta">{ROLE_LABEL[role] ?? role}</div>}
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
