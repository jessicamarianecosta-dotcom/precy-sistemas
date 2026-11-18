import type { PrecyFlowAccent, PrecyFlowTheme } from '@/lib/precyflow/types'

export function ThemeRoot({
  theme = 'cat',
  accent = 'rosa',
  className,
  children,
}: {
  theme?: PrecyFlowTheme
  accent?: PrecyFlowAccent
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`precyflow${className ? ` ${className}` : ''}`}
      data-pf-theme={theme}
      data-pf-accent={accent}
      data-pf-dark="true"
    >
      {children}
    </div>
  )
}
