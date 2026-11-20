'use client'

import { useState, useEffect } from 'react'
import { NumberInput } from './NumberInput'

interface SliderFieldProps {
  label: string
  value: number
  /** Chamado a cada movimento — barato, só atualiza o número exibido. */
  onChange: (value: number) => void
  /** Chamado quando o usuário solta o controle (ou edita o número direto) — use para disparar processamento pesado. */
  onCommit?: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
}

/** Campo com controle deslizante + número, sincronizados — arrastar dá feedback liso; o processamento pesado só roda ao soltar. */
export function SliderField({ label, value, onChange, onCommit, min = 0, max = 10, step = 0.1, suffix = 'mm', disabled }: SliderFieldProps) {
  const [draft, setDraft] = useState(value)

  useEffect(() => setDraft(value), [value])

  const commit = onCommit ?? onChange

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-text-secondary dark:text-stone-400">{label}</label>
        <div className="flex items-center gap-1">
          <NumberInput
            className="input w-16 text-center py-1 text-xs"
            value={draft}
            onChange={(v) => { setDraft(v); commit(v) }}
          />
          {suffix && <span className="text-xs text-text-muted">{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, draft))}
        disabled={disabled}
        onInput={(e) => { onChange(parseFloat((e.target as HTMLInputElement).value)) }}
        onChange={(e) => setDraft(parseFloat(e.target.value))}
        onMouseUp={(e) => commit(parseFloat((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => commit(parseFloat((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => commit(parseFloat((e.target as HTMLInputElement).value))}
        className="w-full accent-primary disabled:opacity-50"
      />
    </div>
  )
}
