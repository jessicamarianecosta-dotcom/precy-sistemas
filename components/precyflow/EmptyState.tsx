import type { LucideIcon } from 'lucide-react'

export function PrecyflowEmptyState({
  icon: Icon, title, subtitle, action,
}: {
  icon: LucideIcon
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 pf-bg-primary-soft">
        <Icon size={24} className="pf-text-primary-accent" />
      </div>
      <p className="font-semibold">{title}</p>
      {subtitle && <p className="text-sm mt-1 max-w-sm" style={{ color: 'var(--pf-text-secondary)' }}>{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
