'use client'

import { PaintBucket, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useMontagemStore } from '@/lib/montagem/store'
import { Toggle } from '@/components/ui/Toggle'
import { SliderField } from '@/components/ui/SliderField'

const PRESET_COLORS = [
  { label: 'Branco', value: '#ffffff' },
  { label: 'Preto', value: '#000000' },
]

export function BorderPanel() {
  const art = useMontagemStore((s) => s.art)
  const border = useMontagemStore((s) => s.border)
  const setBorderEnabled = useMontagemStore((s) => s.setBorderEnabled)
  const setBorderWidthMm = useMontagemStore((s) => s.setBorderWidthMm)
  const setBorderColor = useMontagemStore((s) => s.setBorderColor)
  const loading = useMontagemStore((s) => s.loading)

  const canUseBorder = !!art?.hasAlpha

  return (
    <div className="card rounded-2xl p-4 space-y-3">
      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <span className="flex items-center gap-2 font-semibold text-sm text-text-primary dark:text-stone-100">
          {loading ? <Loader2 size={16} className="animate-spin text-primary" /> : <PaintBucket size={16} className={border.enabled ? 'text-primary' : 'text-text-muted'} />}
          Adicionar borda
        </span>
        <Toggle checked={border.enabled} onChange={setBorderEnabled} disabled={!canUseBorder || loading} label="Adicionar borda" />
      </label>

      {!canUseBorder && (
        <p className="text-[11px] text-text-muted">
          Use &ldquo;Remover fundo&rdquo; nos ajustes da arte primeiro — a borda é desenhada ao redor da silhueta, que só existe com transparência.
        </p>
      )}

      {canUseBorder && border.enabled && (
        <>
          <SliderField
            label="Espessura da borda"
            value={border.widthMm}
            min={0.5}
            max={15}
            step={0.1}
            onChange={() => {}}
            onCommit={(v) => setBorderWidthMm(v)}
            disabled={loading}
          />

          <div>
            <label className="text-xs font-medium text-text-secondary dark:text-stone-400">Cor da borda</label>
            <div className="flex items-center gap-1.5 mt-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setBorderColor(c.value)}
                  disabled={loading}
                  className={clsx(
                    'flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50',
                    border.color.toLowerCase() === c.value ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400',
                  )}
                >
                  {c.label}
                </button>
              ))}
              <input
                type="color"
                value={border.color}
                onChange={(e) => setBorderColor(e.target.value)}
                disabled={loading}
                className="w-9 h-8 rounded-lg border border-border dark:border-border-dark cursor-pointer disabled:opacity-50"
                title="Escolher cor (o seletor do navegador tem conta-gotas para pegar a cor de qualquer lugar da tela)"
              />
            </div>
            <p className="text-[11px] text-text-muted mt-1.5">
              No seletor de cor, use o ícone de conta-gotas para pegar uma cor direto da própria arte.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
