'use client'

import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

interface Props {
  value:       string
  onChange:    (value: string) => void
  placeholder?: string
  className?:  string
}

/**
 * Busca com debounce interno — a UI responde instantaneamente à digitação,
 * mas só propaga (e recomputa a lista filtrada) 250ms depois de parar de
 * digitar, evitando recomputar o filtro a cada tecla.
 */
export function FinanceSearch({ value, onChange, placeholder = 'Buscar por descrição, cliente, categoria...', className }: Props) {
  const [text, setText] = useState(value)
  const debounced = useDebouncedValue(text, 250)

  // Sincroniza se o valor externo mudar (ex: "Limpar filtros")
  useEffect(() => { setText(value) }, [value])
  useEffect(() => { if (debounced !== value) onChange(debounced) }, [debounced]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={className ?? 'relative flex-1 min-w-0'}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
      <input
        className="input pl-9 pr-8 text-sm w-full"
        placeholder={placeholder}
        value={text}
        onChange={e => setText(e.target.value)}
      />
      {text && (
        <button
          type="button"
          onClick={() => setText('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary dark:hover:text-stone-300 transition-colors"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
