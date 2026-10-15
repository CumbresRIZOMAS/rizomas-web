import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useApiQuery } from '../shared/api/hooks'
import type { Evidence, Role } from '../shared/api/types'
import { canDo, ROLES, useAuth } from '../shared/auth/context'
import { useActiveFarm } from '../shared/farm/context'
import { ROLE_LABEL, initials } from '../shared/format'
import { Icon, type IconName } from '../shared/ui'

type NavItem = { to: string; label: string; icon: IconName; roles?: readonly Role[] }

const NAV: NavItem[] = [
  { to: '/inicio', label: 'Inicio', icon: 'home' },
  { to: '/fincas', label: 'Fincas', icon: 'farm' },
  { to: '/lotes', label: 'Lotes y cultivos', icon: 'leaf' },
  { to: '/labores', label: 'Labores', icon: 'tool' },
  { to: '/cosechas', label: 'Cosechas', icon: 'coffee' },
  { to: '/suelos', label: 'Suelos y diagnósticos', icon: 'soil' },
  { to: '/bioinsumos', label: 'Bioinsumos', icon: 'drop' },
  { to: '/cafe', label: 'Procesos de café', icon: 'process' },
  { to: '/trazabilidad', label: 'Trazabilidad', icon: 'trace' },
  { to: '/comercial', label: 'Comercial', icon: 'wallet', roles: ROLES.verComercial },
  { to: '/evidencias', label: 'Evidencias', icon: 'camera', roles: ROLES.moderarEvidencias },
  { to: '/reportes', label: 'Reportes', icon: 'report', roles: ROLES.verReportes },
  { to: '/usuarios', label: 'Usuarios', icon: 'users', roles: ROLES.gestionarUsuarios },
]

export function AppLayout() {
  const { email, role, signOut } = useAuth()
  const { farms, farm, setFarmId } = useActiveFarm()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [mobileNav, setMobileNav] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const puedeModerar = canDo(role, ROLES.moderarEvidencias)
  const pendientes = useApiQuery<Evidence[]>(puedeModerar ? '/evidence/moderation/pending' : null)
  const pendientesCount = pendientes.data?.length ?? 0

  const items = NAV.filter((item) => !item.roles || canDo(role, item.roles))
  const actual = items.find((item) => pathname.startsWith(item.to))

  function buscar(e: FormEvent) {
    e.preventDefault()
    const q = search.trim()
    navigate(q ? `/fincas?q=${encodeURIComponent(q)}` : '/fincas')
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <Icon name="leaf" size={25} />
          </div>
          <div>
            <strong>RIZOMAS</strong>
            <span>Cumbres Sacras</span>
          </div>
          <button type="button" className="close-nav" onClick={() => setMobileNav(false)} aria-label="Cerrar menú">
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label="Principal">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setMobileNav(false)}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.to === '/evidencias' && pendientesCount > 0 && <i>{pendientesCount}</i>}
            </NavLink>
          ))}
        </nav>
      </aside>
      {mobileNav && <button type="button" className="nav-overlay" onClick={() => setMobileNav(false)} aria-label="Cerrar navegación" />}
      <div className="main-shell">
        <header className="topbar">
          <button type="button" className="menu-button" onClick={() => setMobileNav(true)} aria-label="Abrir menú">
            <Icon name="menu" />
          </button>
          <div className="farm-selector">
            <span>Finca activa</span>
            {farms.length > 0 ? (
              <div className="farm-select">
                <Icon name="farm" size={18} />
                <select aria-label="Finca activa" value={farm?.id ?? ''} onChange={(e) => setFarmId(e.target.value)}>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <button type="button" onClick={() => navigate('/fincas')}>
                <Icon name="farm" size={18} />
                <strong>Sin fincas</strong>
              </button>
            )}
          </div>
          <form className="global-search" onSubmit={buscar} role="search">
            <Icon name="search" size={19} />
            <input placeholder="Buscar finca por nombre o municipio..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
          {puedeModerar && (
            <Link className="notification" to="/evidencias" aria-label={`${pendientesCount} evidencias pendientes de revisión`} style={{ marginLeft: 'auto' }}>
              <Icon name="bell" />
              {pendientesCount > 0 && <i>{pendientesCount}</i>}
            </Link>
          )}
          <div className="profile-wrap" style={puedeModerar ? undefined : { marginLeft: 'auto' }}>
            <button type="button" className="profile" onClick={() => setProfileOpen((v) => !v)} aria-expanded={profileOpen}>
              <span>{initials(email ?? '?')}</span>
              <div>
                <strong>{email}</strong>
                <small>{role ? (ROLE_LABEL[role] ?? role) : 'Sin rol asignado'}</small>
              </div>
              <Icon name="chevron" size={14} />
            </button>
            {profileOpen && (
              <div className="profile-menu" onMouseLeave={() => setProfileOpen(false)}>
                <span>{email}</span>
                <Link to="/" onClick={() => setProfileOpen(false)}>
                  Ver portal público
                </Link>
                <button type="button" onClick={() => void signOut()}>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>
        <main>
          <div className="breadcrumb">
            RIZOMAS <span>/</span> {actual?.label ?? 'Panel'}
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
