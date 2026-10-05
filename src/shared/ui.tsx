import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

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
    <header className="page-header">
      <div>
        {breadcrumb && <nav className="breadcrumb">{breadcrumb}</nav>}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="form-actions">{actions}</div>}
    </header>
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
      {message}{' '}
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
    <div className="empty">
      <strong>{title}</strong>
      {children}
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
      <input className="input" {...input} />
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
      <textarea className="input" {...input} />
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
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <label className="field">
      <span>
        {label} {optional && <small>(opcional)</small>}
      </span>
      <select className="input" {...select}>
        {children}
      </select>
      {hint && <small className="hint">{hint}</small>}
    </label>
  )
}

/** Tarjeta con un formulario que se abre y cierra desde un botón. */
export function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card" aria-label={title}>
      <h2 className="section-title">{title}</h2>
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
        <button key={t.id} type="button" role="tab" aria-selected={t.id === active} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}
