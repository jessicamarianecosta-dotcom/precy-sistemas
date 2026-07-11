'use client'

import { useEffect, useState, useCallback } from 'react'

export interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
  photo?: string | null
}

function storageKey(slug: string) {
  return `precy-catalogo-cart-${slug}`
}

export function useCart(slug: string) {
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(slug))
      if (raw) setItems(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [slug])

  const persist = useCallback((next: CartItem[]) => {
    setItems(next)
    try { localStorage.setItem(storageKey(slug), JSON.stringify(next)) } catch { /* ignore */ }
  }, [slug])

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === item.productId)
      const next = existing
        ? prev.map(i => i.productId === item.productId ? { ...i, quantity: i.quantity + item.quantity } : i)
        : [...prev, item]
      try { localStorage.setItem(storageKey(slug), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [slug])

  const updateQty = useCallback((productId: string, quantity: number) => {
    setItems(prev => {
      const next = quantity <= 0
        ? prev.filter(i => i.productId !== productId)
        : prev.map(i => i.productId === productId ? { ...i, quantity } : i)
      try { localStorage.setItem(storageKey(slug), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [slug])

  const removeItem = useCallback((productId: string) => updateQty(productId, 0), [updateQty])
  const clear = useCallback(() => persist([]), [persist])

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)

  return { items, addItem, updateQty, removeItem, clear, total }
}
