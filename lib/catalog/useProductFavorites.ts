'use client'

import { useCallback, useEffect, useState } from 'react'

function storageKey(slug: string) {
  return `precy-catalogo-favoritos-produtos-${slug}`
}

/** Produtos favoritados pelo visitante dentro de UMA loja — local ao navegador. */
export function useProductFavorites(slug: string) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(slug))
      setFavoriteIds(raw ? JSON.parse(raw) : [])
    } catch {
      setFavoriteIds([])
    }
  }, [slug])

  const isFavorite = useCallback((productId: string) => favoriteIds.includes(productId), [favoriteIds])

  const toggle = useCallback((productId: string) => {
    setFavoriteIds(prev => {
      const next = prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
      try { localStorage.setItem(storageKey(slug), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [slug])

  return { favoriteIds, isFavorite, toggle }
}
