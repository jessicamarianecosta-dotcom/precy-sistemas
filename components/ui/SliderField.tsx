'use client'

import { useEffect, useRef, useState } from 'react'
import { NumberInput } from './NumberInput'

interface SliderFieldProps {
  label: string
  value: number
  /** Chamado a cada movimento — barato, só atualiza o número exibido. */
  onChange: (value: number) => void
  /**
   * Chamado para aplicar o valor de verdade (reprocessa a arte). Disparado
   * com um debounce curto enquanto arrasta (sensação de tempo real, sem
   * reprocessar a cada pixel) e também imediatamente ao soltar/editar o
   * número, garantindo que o valor final seja sempre aplicado.
   */
  onCommit?: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
}

const DEBOUNCE_MS = 120

/** Campo com controle deslizante + número, sincronizados — arrastar atualiza o número na hora e aplica o processamento pesado pouco depois (debounce), sem travar a cada pixel movido. */
export function SliderField({ label, value, onChange, onCommit, min = 0, max = 10, step = 0.1, suffix = 'mm', disabled }: SliderFieldProps) {
  const [draft, setDraft] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setDraft(value), [value])
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const commit = onCommit ?? onChange

  function scheduleCommit(v: number) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => commit(v), DEBOUNCE_MS)
  }

  function flushCommit(v: number) {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    commit(v)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-text-secondary dark:text-stone-400">{label}</label>
        <div className="flex items-center gap-1">
          <NumberInput
            className="input w-16 text-center py-1 text-xs"
            value={draft}
            onChange={(v) => { setDraft(v); flushCommit(v) }}
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
        onInput={(e) => {
          const v = parseFloat((e.target as HTMLInputElement).value)
          onChange(v)
          scheduleCommit(v)
        }}
        onChange={(e) => setDraft(parseFloat(e.target.value))}
        onMouseUp={(e) => flushCommit(parseFloat((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => flushCommit(parseFloat((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => flushCommit(parseFloat((e.target as HTMLInputElement).value))}
        className="w-full accent-primary disabled:opacity-50"
      />
    </div>
  )
}
