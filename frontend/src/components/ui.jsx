import { AlertCircle, ArrowUpRight, LoaderCircle } from 'lucide-react'

export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  )
}

export function Notice({ children, tone = 'error' }) {
  const Icon = tone === 'error' ? AlertCircle : ArrowUpRight

  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}

export function LoadingState({ label = 'Loading records' }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={20} aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={25} strokeWidth={1.7} aria-hidden="true" />}
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function StatusPill({ active, children }) {
  return (
    <span className={`status-pill ${active ? 'status-active' : 'status-inactive'}`}>
      <span className="status-dot" />
      {children || (active ? 'Active' : 'Inactive')}
    </span>
  )
}

export function IconButton({ label, children, ...props }) {
  return (
    <button className="icon-button" aria-label={label} title={label} {...props}>
      {children}
    </button>
  )
}