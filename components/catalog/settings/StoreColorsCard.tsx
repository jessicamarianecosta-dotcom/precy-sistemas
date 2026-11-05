'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { Check, Pipette, Sun, Moon, SlidersHorizontal } from 'lucide-react'
import type { SettingsCardProps } from '@/app/(dashboard)/catalogo/catalogSettingsTypes'
import { generatePaletteFromBase, resolvePalettes, type StoreThemeMode, type StoreThemePalette } from '@/lib/catalog/theme/palette'

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

const FIELD_LABELS: Record<keyof StoreThemePalette, string> = {
  primary: 'Cor principal',
  secondary: 'Cor secundária',
  accent: 'Destaque',
  background: 'Fundo',
  surface: 'Superfície (cards)',
  text: 'Texto',
  textSecondary: 'Texto secundário',
  border: 'Bordas',
  buttonText: 'Texto dos botões',
}

export function StoreColorsCard({ value, onChange }: SettingsCardProps) {
  const [tab, setTab] = useState<StoreThemeMode>('light')
  const [advanced, setAdvanced] = useState(false)

  const palettes = resolvePalettes(value)
  const isQuickColor = QUICK_COLORS.some(c => c.value.toLowerCase() === value.theme_color.toLowerCase())

  function applyBaseColor(hex: string) {
    const generated = generatePaletteFromBase(hex)
    onChange({ theme_color: hex, theme_palette: generated })
  }

  function updateField(mode: StoreThemeMode, field: keyof StoreThemePalette, hex: string) {
    const nextPalette = { ...palettes, [mode]: { ...palettes[mode], [field]: hex } }
    const patch: Partial<typeof value> = { theme_palette: nextPalette }
    if (mode === 'light' && field === 'primary') patch.theme_color = hex
    onChange(patch)
  }

  const active = palettes[tab]

  return (
    <div className="card p-5 space-y-4">
      <div>
        <h3 className="text-base font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
          <Pipette size={17} className="text-primary" /> Cores da Loja
        </h3>
        <p className="text-sm text-text-secondary dark:text-stone-400 mt-1">
          Escolha a cor principal — o sistema gera toda a paleta (claro e escuro) automaticamente. Use &quot;Avançado&quot; para ajustar cada tom.
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
            onClick={() => applyBaseColor(c.value)}
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
            onChange={e => applyBaseColor(e.target.value)}
          />
        </label>
      </div>

      <div className="border-t border-border dark:border-border-dark pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-lg border border-border dark:border-border-dark overflow-hidden">
            <button
              type="button"
              onClick={() => setTab('light')}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold', tab === 'light' ? 'bg-primary text-white' : 'text-text-secondary dark:text-stone-400')}
            >
              <Sun size={13} /> Tema claro
            </button>
            <button
              type="button"
              onClick={() => setTab('dark')}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold', tab === 'dark' ? 'bg-primary text-white' : 'text-text-secondary dark:text-stone-400')}
            >
              <Moon size={13} /> Tema escuro
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAdvanced(a => !a)}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary"
          >
            <SlidersHorizontal size={13} /> {advanced ? 'Ocultar avançado' : 'Avançado'}
          </button>
        </div>

        {/* Preview ao vivo do tema selecionado */}
        <div
          className="rounded-xl p-4 border"
          style={{ backgroundColor: active.background, borderColor: active.border }}
        >
          <div className="rounded-lg p-3 mb-2" style={{ backgroundColor: active.surface }}>
            <p className="text-sm font-semibold" style={{ color: active.text }}>Nome do produto</p>
            <p className="text-xs" style={{ color: active.textSecondary }}>Descrição de exemplo da loja</p>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ backgroundColor: active.primary, color: active.buttonText }}>Comprar</span>
            <span className="px-3 py-1.5 rounded-lg text-xs font-bold border" style={{ borderColor: active.accent, color: active.accent }}>Novidade</span>
          </div>
        </div>

        {advanced && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(Object.keys(FIELD_LABELS) as (keyof StoreThemePalette)[]).map(field => (
              <label key={field} className="flex items-center gap-2 text-xs">
                <input
                  type="color"
                  value={active[field]}
                  onChange={e => updateField(tab, field, e.target.value)}
                  className="w-8 h-8 rounded-lg border border-border dark:border-border-dark cursor-pointer"
                />
                <span className="text-text-secondary dark:text-stone-400">{FIELD_LABELS[field]}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
