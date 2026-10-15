import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

// Componentes visuales del diseño de Figma (rizomas web). Las clases CSS
// viven en index.css con los mismos nombres del prototipo.

export type IconName =
  | 'home'
  | 'farm'
  | 'leaf'
  | 'tool'
  | 'coffee'
  | 'soil'
  | 'drop'
  | 'process'
  | 'trace'
  | 'wallet'
  | 'camera'
  | 'report'
  | 'users'
  | 'search'
  | 'bell'
  | 'sync'
  | 'plus'
  | 'arrow'
  | 'lock'
  | 'calendar'
  | 'location'
  | 'check'
  | 'upload'
  | 'chevron'
  | 'menu'
  | 'close'

const PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  farm: (
    <>
      <path d="M3 21V9l9-5 9 5v12" />
      <path d="M7 21v-8h10v8M3 21h18" />
      <path d="M9 9h6" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 4C12 4 5 8 5 15c0 3 2 5 5 5 7 0 10-8 10-16Z" />
      <path d="M4 21c3-5 7-8 12-11" />
    </>
  ),
  tool: (
    <>
      <path d="m14 7 3-3 3 3-3 3" />
      <path d="m15.5 8.5-10 10a2.1 2.1 0 0 1-3-3l10-10" />
      <path d="m13 14 7 7" />
    </>
  ),
  coffee: (
    <>
      <path d="M5 8h12v7a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5Z" />
      <path d="M17 10h1a3 3 0 0 1 0 6h-1M8 3c2 1-1 3 1 4M12 3c2 1-1 3 1 4" />
    </>
  ),
  soil: (
    <>
      <path d="M3 7h18M4 12h16M6 17h12M9 21h6" />
      <path d="M7 7c0-3 2-4 5-4 0 3-2 4-5 4Z" />
    </>
  ),
  drop: <path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z" />,
  process: (
    <>
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="m9 11 6-4M9 13l6 4" />
    </>
  ),
  trace: <path d="M5 3v18M5 6h10l-2-2m2 2-2 2M5 13h13l-2-2m2 2-2 2M5 19h8" />,
  wallet: (
    <>
      <path d="M3 6h16v14H3z" />
      <path d="M3 9h16M15 13h6v4h-6z" />
    </>
  ),
  camera: (
    <>
      <path d="M4 7h4l2-3h4l2 3h4v13H4z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  report: (
    <>
      <path d="M5 3h14v18H5z" />
      <path d="M8 16v-3M12 16V9M16 16v-5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21c0-4 3-7 7-7s7 3 7 7M16 5a4 4 0 0 1 0 7M17 15c3 1 5 3 5 6" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m15 15 6 6" />
    </>
  ),
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />,
  sync: (
    <>
      <path d="M20 7h-5V2M4 17h5v5" />
      <path d="M18 11a7 7 0 0 0-12-5L4 8M6 13a7 7 0 0 0 12 5l2-2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="m9 18 6-6-6-6" />,
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </>
  ),
  location: (
    <>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  upload: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5" />
      <path d="M5 14H3v7h18v-7h-2" />
    </>
  ),
  chevron: <path d="m7 10 5 5 5-5" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

export function Button({
  children,
  variant = 'primary',
  icon,
  onClick,
  type = 'button',
  disabled = false,
}: {
  children: ReactNode
  variant?: ButtonVariant
  icon?: IconName
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return (
    <button className={`btn btn-${variant}`} type={type} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  )
}

export type ChipTone = 'green' | 'amber' | 'blue' | 'terra' | 'gray' | 'coffee'

export function Chip({ children, tone = 'green' }: { children: ReactNode; tone?: ChipTone }) {
  return <span className={`chip chip-${tone}`}>{children}</span>
}

export function Card({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <section className={`card ${className}`} aria-label={label}>
      {children}
    </section>
  )
}

export function CardTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="card-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export function Kpi({ label, value, detail, icon, tone = '' }: { label: string; value: string; detail: string; icon: IconName; tone?: string }) {
  return (
    <Card className="kpi">
      <div className={`kpi-icon ${tone}`}>
        <Icon name={icon} size={21} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </Card>
  )
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  breadcrumb,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  breadcrumb?: ReactNode
}) {
  return (
    <>
      {breadcrumb && <nav className="back-link">{breadcrumb}</nav>}
      <header className="page-heading">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="actions">{actions}</div>}
      </header>
    </>
  )
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <p className="loading" role="status">
      {label}
    </p>
  )
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="notice notice-error" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-inline">
      <strong>{title}</strong>
      {children && <span>{children}</span>}
    </div>
  )
}

/** Estado vacío grande del diseño (círculo con ícono, título y acción). */
export function EmptyState({ icon, title, children, action }: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state card">
      <div>
        <Icon name={icon} size={42} />
      </div>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

type FieldProps = { label: string; optional?: boolean; hint?: string }

export function TextField({ label, optional, hint, ...input }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      <span>
        {label} {optional && <small>(opcional)</small>}
      </span>
      <input {...input} />
      {hint && <small className="hint">{hint}</small>}
    </label>
  )
}

export function TextAreaField({ label, optional, hint, ...input }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="field">
      <span>
        {label} {optional && <small>(opcional)</small>}
      </span>
      <textarea {...input} />
      {hint && <small className="hint">{hint}</small>}
    </label>
  )
}

export function SelectField({
  label,
  optional,
  hint,
  children,
  ...select
}: Partial<FieldProps> & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <label className="field">
      {label && (
        <span>
          {label} {optional && <small>(opcional)</small>}
        </span>
      )}
      <select {...select}>{children}</select>
      {hint && <small className="hint">{hint}</small>}
    </label>
  )
}

/** Tarjeta con un formulario (crear/editar). */
export function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card form-card" aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === active}
          className={t.id === active ? 'active' : ''}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
