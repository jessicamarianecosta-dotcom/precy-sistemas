'use client'

import { useTheme } from 'next-themes'
import { Check, Palette, Sun, Moon, Monitor, LayoutDashboard, Bell } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppTheme } from '@/providers/AppThemeProvider'
import { APP_PALETTES } from '@/lib/theme/palettes'

/**
 * Configurações > Aparência — disponível no Precy Essencial e no Precy Pro.
 * Trocar a paleta ou o modo claro/escuro aplica a mudança imediatamente em
 * toda a interface (ver providers/AppThemeProvider); a prévia abaixo usa os
 * mesmos componentes (.card, .btn-primary, .badge...) do resto do app, então
 * ela já é a interface real — não um desenho separado que pode ficar
 * desatualizado.
 */
export function AppearanceSettingsCard() {
  const { palette, setPalette } = useAppTheme()
  const { theme, setTheme } = useTheme()

  const modeOptions = [
    { value: 'light',  label: 'Claro',    icon: Sun },
    { value: 'dark',   label: 'Escuro',   icon: Moon },
    { value: 'system', label: 'Automático', icon: Monitor },
  ] as const

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border dark:border-border-dark">
        <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary/10 flex-shrink-0">
          <Palette size={18} className="text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Aparência</h3>
          <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">
            Escolha as cores de toda a interface do Precy+ — disponível no Essencial e no Pro.
          </p>
        </div>
      </div>

      {/* ── Paletas ── */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-text-secondary dark:text-stone-400 uppercase tracking-wider mb-3">
          Paleta de cores
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {APP_PALETTES.map(p => {
            const active = palette === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPalette(p.id)}
                className={clsx(
                  'relative flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all duration-200',
                  active
                    ? 'border-primary bg-primary-50 dark:bg-primary/10'
                    : 'border-border dark:border-border-dark hover:border-primary/40'
                )}
              >
                <div className="flex -space-x-1.5 flex-shrink-0">
                  <span className="w-6 h-6 rounded-full border-2 border-white dark:border-surface-dark shadow-sm" style={{ background: p.swatch.primary }} />
                  <span className="w-6 h-6 rounded-full border-2 border-white dark:border-surface-dark shadow-sm" style={{ background: p.swatch.secondary }} />
                  <span className="w-6 h-6 rounded-full border-2 border-white dark:border-surface-dark shadow-sm" style={{ background: p.swatch.accent }} />
                </div>
                <span className="text-sm font-medium text-text-primary dark:text-stone-100">{p.label}</span>
                {active && (
                  <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                    <Check size={12} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Modo claro/escuro ── */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-text-secondary dark:text-stone-400 uppercase tracking-wider mb-3">
          Modo de exibição
        </p>
        <div className="grid grid-cols-3 gap-2">
          {modeOptions.map(opt => {
            const Icon = opt.icon
            const active = theme === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={clsx(
                  'flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-medium transition-all duration-200',
                  active
                    ? 'border-primary bg-primary-50 dark:bg-primary/10 text-primary'
                    : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400 hover:border-primary/40'
                )}
              >
                <Icon size={16} />
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Prévia ao vivo ── */}
      <div>
        <p className="text-xs font-semibold text-text-secondary dark:text-stone-400 uppercase tracking-wider mb-3">
          Prévia
        </p>
        <div className="rounded-xl border border-border dark:border-border-dark overflow-hidden">
          {/* Barra de menu simulada */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-primary">
            <LayoutDashboard size={14} className="text-white" />
            <span className="text-xs font-semibold text-white">Precy+</span>
            <Bell size={13} className="text-white/80 ml-auto" />
          </div>
          {/* Conteúdo simulado */}
          <div className="p-4 bg-background dark:bg-background-dark space-y-3">
            <div className="flex items-center justify-between">
              <div className="card p-3 flex-1 mr-2">
                <p className="text-[10px] text-text-muted dark:text-stone-400 uppercase tracking-wide">Faturamento</p>
                <p className="text-lg font-bold text-primary">R$ 4.250,00</p>
              </div>
              <div className="card p-3 flex-1">
                <p className="text-[10px] text-text-muted dark:text-stone-400 uppercase tracking-wide">Pedidos</p>
                <p className="text-lg font-bold text-secondary">18</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-primary text-xs py-2">Novo orçamento</button>
              <button type="button" className="btn-secondary text-xs py-2">Ver relatório</button>
              <span className="badge badge-primary ml-auto">Pro</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
