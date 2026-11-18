import type { LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="pf-empty-state">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: 'color-mix(in srgb, var(--pf-primary) 10%, transparent)' }}
      >
        <Icon size={24} style={{ color: 'var(--pf-primary)' }} />
      </div>
      <h3 className="font-semibold mb-1" style={{ color: 'var(--pf-text)' }}>{title}</h3>
      {description && <p className="text-sm mb-4 max-w-xs" style={{ color: 'var(--pf-text-secondary)' }}>{description}</p>}
      {action}
    </div>
  )
}
