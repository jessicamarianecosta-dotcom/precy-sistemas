'use client'

interface Props {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  suffix?: string
}

export function NumberField({ label, value, onChange, step = 1, min = 0, suffix }: Props) {
  return (
    <div>
      <label className="text-xs font-medium text-text-secondary dark:text-stone-400">{label}</label>
      <div className="relative mt-1">
        <input
          type="number"
          className="input w-full"
          step={step}
          min={min}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted pointer-events-none">{suffix}</span>
        )}
      </div>
    </div>
  )
}

interface MarginsProps {
  margins: { top: number; right: number; bottom: number; left: number }
  onChange: (margins: { top: number; right: number; bottom: number; left: number }) => void
}

export function MarginsFields({ margins, onChange }: MarginsProps) {
  return (
    <div>
      <label className="text-xs font-medium text-text-secondary dark:text-stone-400">Margens (mm)</label>
      <div className="grid grid-cols-4 gap-2 mt-1.5">
        <input type="number" className="input text-center" title="Superior" placeholder="Sup."
          value={margins.top} onChange={(e) => onChange({ ...margins, top: parseFloat(e.target.value) || 0 })} />
        <input type="number" className="input text-center" title="Direita" placeholder="Dir."
          value={margins.right} onChange={(e) => onChange({ ...margins, right: parseFloat(e.target.value) || 0 })} />
        <input type="number" className="input text-center" title="Inferior" placeholder="Inf."
          value={margins.bottom} onChange={(e) => onChange({ ...margins, bottom: parseFloat(e.target.value) || 0 })} />
        <input type="number" className="input text-center" title="Esquerda" placeholder="Esq."
          value={margins.left} onChange={(e) => onChange({ ...margins, left: parseFloat(e.target.value) || 0 })} />
      </div>
    </div>
  )
}

interface SpacingProps {
  spacing: { x: number; y: number }
  onChange: (spacing: { x: number; y: number }) => void
}

export function SpacingFields({ spacing, onChange }: SpacingProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberField label="Espaçamento horizontal (mm)" value={spacing.x} step={0.5} onChange={(x) => onChange({ ...spacing, x })} />
      <NumberField label="Espaçamento vertical (mm)" value={spacing.y} step={0.5} onChange={(y) => onChange({ ...spacing, y })} />
    </div>
  )
}
