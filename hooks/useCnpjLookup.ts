import { useCallback, useRef, useState } from 'react'
import { fetchCnpjData, normalizeCnpj, type CnpjData } from '@/lib/services/cnpj'

// Cache em memória, válido durante a sessão do browser — evita reconsultar o
// mesmo CNPJ várias vezes na mesma visita. Simples de propósito.
const cnpjCache = new Map<string, CnpjData>()

interface UseCnpjLookupOptions {
  onFound?: (data: CnpjData) => void
}

export function useCnpjLookup(options: UseCnpjLookupOptions = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onFoundRef = useRef(options.onFound)
  onFoundRef.current = options.onFound

  const search = useCallback(async (rawCnpj: string) => {
    const cnpj = normalizeCnpj(rawCnpj)
    setError(null)

    const cached = cnpjCache.get(cnpj)
    if (cached) {
      onFoundRef.current?.(cached)
      return { ok: true as const, data: cached }
    }

    setLoading(true)
    const result = await fetchCnpjData(cnpj)
    setLoading(false)

    if (!result.ok) {
      setError(result.message)
      return result
    }

    cnpjCache.set(cnpj, result.data)
    onFoundRef.current?.(result.data)
    return result
  }, [])

  return { search, loading, error, clearError: () => setError(null) }
}
