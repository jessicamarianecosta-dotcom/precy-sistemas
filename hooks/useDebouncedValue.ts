'use client'

import { useEffect, useState } from 'react'

/** Devolve `value` com atraso de `delayMs` — usado para não recomputar filtros a cada tecla digitada. */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
