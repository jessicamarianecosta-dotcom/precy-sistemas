'use client'

import { useEffect, useState } from 'react'

/**
 * Campo numérico que nunca mostra um "0" fantasma ao digitar.
 *
 * Com `<input type="number">` controlado por um `value` numérico, apagar o
 * campo e digitar "2" vira "02" (o DOM mantém o "0" renderizado do estado
 * enquanto o teclado ainda não processou a tecla). Aqui o campo é
 * `type="text"` com estado de texto próprio: o usuário pode apagar tudo e
 * ficar com o campo vazio (cursor piscando), sem um 0 forçado. O valor
 * numérico só é resolvido (e sincronizado de volta) no blur ou quando o
 * texto já forma um número válido.
 */
interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  className?: string
  placeholder?: string
  id?: string
  title?: string
  "aria-label"?: string
}

export function NumberInput({ value, onChange, className, placeholder, id, title, ...rest }: NumberInputProps) {
  const [text, setText] = useState(() => formatValue(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(formatValue(value))
  }, [value, focused])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    // Só deixa dígitos, um separador decimal (. ou ,) e um sinal de menos no início.
    if (!/^-?[0-9]*[.,]?[0-9]*$/.test(raw)) return
    setText(raw)
    const parsed = parseLocaleNumber(raw)
    if (parsed !== null) onChange(parsed)
  }

  function handleFocus() {
    setFocused(true)
  }

  function handleBlur() {
    setFocused(false)
    const parsed = parseLocaleNumber(text) ?? 0
    setText(formatValue(parsed))
    if (parsed !== value) onChange(parsed)
  }

  return (
    <input
      id={id}
      title={title}
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      value={text}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...rest}
    />
  )
}

function parseLocaleNumber(raw: string): number | null {
  if (raw === '' || raw === '-' || raw === ',' || raw === '.') return null
  const normalized = raw.replace(',', '.')
  const parsed = parseFloat(normalized)
  return Number.isNaN(parsed) ? null : parsed
}

function formatValue(v: number): string {
  if (!Number.isFinite(v)) return ''
  return String(v).replace('.', ',')
}
