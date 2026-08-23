import { useCallback, useRef, useState } from 'react'
import { fetchCepData, normalizeCep, isValidCepLength, type CepData } from '@/lib/services/cep'

const cepCache = new Map<string, CepData>()

interface UseCepLookupOptions {
  onFound?: (data: CepData) => void
}

export function useCepLookup(options: UseCepLookupOptions = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastSearchedRef = useRef<string | null>(null)
  const onFoundRef = useRef(options.onFound)
  onFoundRef.current = options.onFound

  const search = useCallback(async (rawCep: string) => {
    const cep = normalizeCep(rawCep)
    setError(null)

    const cached = cepCache.get(cep)
    if (cached) {
      onFoundRef.current?.(cached)
      return { ok: true as const, data: cached }
    }

    setLoading(true)
    const result = await fetchCepData(cep)
    setLoading(false)

    if (!result.ok) {
      setError(result.message)
      return result
    }

    cepCache.set(cep, result.data)
    onFoundRef.current?.(result.data)
    return result
  }, [])

  /** Dispara a busca automaticamente quando o valor completar 8 dígitos (sem repetir o mesmo CEP). */
  const searchOnComplete = useCallback((rawCep: string) => {
    const cep = normalizeCep(rawCep)
    if (!isValidCepLength(cep) || cep === lastSearchedRef.current) return
    lastSearchedRef.current = cep
    void search(cep)
  }, [search])

  return { search, searchOnComplete, loading, error, clearError: () => setError(null) }
}
