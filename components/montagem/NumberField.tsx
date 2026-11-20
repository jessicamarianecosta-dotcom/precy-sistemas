'use client'

import { NumberInput } from '@/components/ui/NumberInput'

interface Props {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  suffix?: string
}

export function NumberField({ label, value, onChange, suffix }: Props) {
  return (
    <div>
      <label className="text-xs font-medium text-text-secondary dark:text-stone-400">{label}</label>
      <div className="relative mt-1">
        <NumberInput className="input w-full" value={value} onChange={onChange} />
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
  unit?: string
}

export function MarginsFields({ margins, onChange, unit = 'mm' }: MarginsProps) {
  return (
    <div>
      <label className="text-xs font-medium text-text-secondary dark:text-stone-400">Margens ({unit})</label>
      <div className="grid grid-cols-4 gap-2 mt-1.5">
        <NumberInput className="input text-center" title="Superior" placeholder="Sup."
          value={margins.top} onChange={(top) => onChange({ ...margins, top })} />
        <NumberInput className="input text-center" title="Direita" placeholder="Dir."
          value={margins.right} onChange={(right) => onChange({ ...margins, right })} />
        <NumberInput className="input text-center" title="Inferior" placeholder="Inf."
          value={margins.bottom} onChange={(bottom) => onChange({ ...margins, bottom })} />
        <NumberInput className="input text-center" title="Esquerda" placeholder="Esq."
          value={margins.left} onChange={(left) => onChange({ ...margins, left })} />
      </div>
    </div>
  )
}

interface SpacingProps {
  spacing: { x: number; y: number }
  onChange: (spacing: { x: number; y: number }) => void
  unit?: string
}

export function SpacingFields({ spacing, onChange, unit = 'mm' }: SpacingProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberField label={`Espaçamento horizontal (${unit})`} value={spacing.x} onChange={(x) => onChange({ ...spacing, x })} />
      <NumberField label={`Espaçamento vertical (${unit})`} value={spacing.y} onChange={(y) => onChange({ ...spacing, y })} />
    </div>
  )
}

/** Seletor de unidade compacto (mm/cm/m) — mesmo padrão usado na importação da arte. */
export function UnitToggle({ unit, onChange }: { unit: 'mm' | 'cm' | 'm'; onChange: (u: 'mm' | 'cm' | 'm') => void }) {
  return (
    <div className="flex gap-1.5">
      {(['mm', 'cm', 'm'] as const).map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u)}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${unit === u ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400'}`}
        >
          {u}
        </button>
      ))}
    </div>
  )
}
