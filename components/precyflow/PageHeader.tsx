export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--pf-text)' }}>{title}</h1>
        {description && <p className="text-sm mt-1" style={{ color: 'var(--pf-text-secondary)' }}>{description}</p>}
      </div>
      {action}
    </div>
  )
}
