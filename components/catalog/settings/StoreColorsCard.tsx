'use client'

import { clsx } from 'clsx'
import { Check, Pipette } from 'lucide-react'
import type { SettingsCardProps } from '@/app/(dashboard)/catalogo/catalogSettingsTypes'

const QUICK_COLORS = [
  { label: 'Marrom',   value: '#8B6C4F' },
  { label: 'Preto',    value: '#1C1C1C' },
  { label: 'Azul',     value: '#2563EB' },
  { label: 'Verde',    value: '#16A34A' },
  { label: 'Vermelho', value: '#DC2626' },
  { label: 'Roxo',     value: '#7C3AED' },
  { label: 'Amarelo',  value: '#EAB308' },
  { label: 'Laranja',  value: '#EA580C' },
  { label: 'Branco',   value: '#F5F5F4' },
]

export function StoreColorsCard({ value, onChange }: SettingsCardProps) {
  const isQuickColor = QUICK_COLORS.some(c => c.value.toLowerCase() === value.theme_color.toLowerCase())

  return (
    <div className="card p-5 space-y-4">
      <div>
        <h3 className="text-base font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
          <Pipette size={17} className="text-primary" /> Cores da Loja
        </h3>
        <p className="text-sm text-text-secondary dark:text-stone-400 mt-1">
          A cor principal aparece nos botões, selos e destaques da sua loja pública.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-2xl shadow-sm border border-border dark:border-border-dark flex-shrink-0"
          style={{ backgroundColor: value.theme_color }}
        />
        <div>
          <p className="text-xs text-text-muted dark:text-stone-500 mb-1">Cor Principal</p>
          <p className="text-sm font-mono font-semibold text-text-primary dark:text-stone-100">{value.theme_color}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_COLORS.map(c => (
          <button
            key={c.value}
            type="button"
            title={c.label}
            onClick={() => onChange({ theme_color: c.value })}
            className={clsx(
              'w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110 border border-black/10',
              value.theme_color.toLowerCase() === c.value.toLowerCase() && 'ring-2 ring-offset-2 ring-primary dark:ring-offset-surface-dark'
            )}
            style={{ backgroundColor: c.value }}
          >
            {value.theme_color.toLowerCase() === c.value.toLowerCase() && (
              <Check size={14} className={c.value === '#F5F5F4' || c.value === '#EAB308' ? 'text-stone-800' : 'text-white'} />
            )}
          </button>
        ))}

        <label
          className={clsx(
            'w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-2 border-dashed border-border dark:border-border-dark hover:border-primary transition-colors relative overflow-hidden',
            !isQuickColor && 'ring-2 ring-offset-2 ring-primary dark:ring-offset-surface-dark border-solid'
          )}
          style={!isQuickColor ? { backgroundColor: value.theme_color } : undefined}
          title="Personalizada"
        >
          {isQuickColor && <span className="text-[9px] font-bold text-text-muted">+</span>}
          <input
            type="color"
            className="absolute inset-0 opacity-0 cursor-pointer"
            value={value.theme_color}
            onChange={e => onChange({ theme_color: e.target.value })}
          />
        </label>
      </div>
    </div>
  )
}
