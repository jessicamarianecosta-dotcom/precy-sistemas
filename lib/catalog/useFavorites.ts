'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'precy-catalogo-favoritos'

function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Lojas favoritadas pelo visitante — local ao navegador (sem conta de cliente final). */
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => { setFavorites(readFavorites()) }, [])

  const isFavorite = useCallback((slug: string) => favorites.includes(slug), [favorites])

  const toggle = useCallback((slug: string) => {
    setFavorites(prev => {
      const next = prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  return { favorites, isFavorite, toggle }
}
