import { initials } from '../lib/format'

export function Logo({ size = 'md', tone = 'brand' }) {
  const box = size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl'
  const text = size === 'sm' ? 'text-lg' : 'text-xl'

  // The mark sits on white in every version, so it needs a light chip to read
  // against the purple sidebar as well as the white one.
  const chip = tone === 'onDark' ? 'bg-white' : 'bg-white ring-1 ring-hairline'

  return (
    <div className="flex items-center gap-3">
      <div className={`${box} ${chip} grid shrink-0 place-items-center overflow-hidden`}>
        <img src="/logo-mark.png" alt="" className={size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'} />
      </div>
      <span className={`${text} font-bold tracking-tight ${tone === 'onDark' ? 'text-white' : 'text-purple-500'}`}>
        EdvVoice
      </span>
    </div>
  )
}

const variants = {
  primary: 'bg-orange-500 text-white shadow-glow hover:bg-orange-600 disabled:bg-orange-200 disabled:shadow-none',
  purple: 'bg-purple-500 text-white hover:bg-purple-600 disabled:bg-purple-200',
  soft: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
  outline: 'border border-hairline bg-white text-ink-soft hover:border-purple-200 hover:text-purple-600',
  ghost: 'text-ink-soft hover:bg-purple-50 hover:text-purple-600',
  danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
}

export function Button({ variant = 'primary', className = '', as: Tag = 'button', ...props }) {
  return (
    <Tag
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold
                  transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export function Card({ className = '', ...props }) {
  return <div className={`rounded-2xl border border-hairline bg-white shadow-card ${className}`} {...props} />
}

const statusTone = {
  Pending: 'bg-orange-50 text-orange-700 ring-orange-200',
  'In Progress': 'bg-amber-50 text-amber-700 ring-amber-200',
  Resolved: 'bg-purple-50 text-purple-600 ring-purple-200',
  Rejected: 'bg-red-50 text-red-600 ring-red-200',
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold
                      ring-1 ring-inset ${statusTone[status] || 'bg-gray-50 text-ink-soft ring-hairline'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}

export function CategoryChip({ children }) {
  return (
    <span className="inline-flex rounded-md bg-canvas px-2.5 py-1 text-xs font-medium text-ink-soft">
      {children}
    </span>
  )
}

export function Avatar({ name, className = '' }) {
  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-purple-100
                      text-xs font-semibold text-purple-600 ${className}`}>
      {initials(name) || 'S'}
    </span>
  )
}

/** An empty screen should tell you what to do next, not just that it is empty. */
export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      {Icon && (
        <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-purple-50 text-purple-400">
          <Icon className="h-6 w-6" strokeWidth={1.8} />
        </div>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-mute">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Notice({ tone = 'info', children }) {
  const tones = {
    info: 'bg-purple-50 text-purple-700',
    error: 'bg-red-50 text-red-700',
    success: 'bg-emerald-50 text-emerald-700',
  }
  return <div className={`rounded-xl px-4 py-3 text-sm font-medium ${tones[tone]}`}>{children}</div>
}

export function PageHeading({ title, subtitle, children }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">{subtitle}</p>}
      </div>
      {children && <div className="flex gap-3">{children}</div>}
    </div>
  )
}
