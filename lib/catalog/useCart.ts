'use client'

import { useEffect, useState, useCallback } from 'react'

export interface CartItem {
  productId: string
  variantId?: string | null
  variantLabel?: string | null
  variantSku?: string | null
  name: string
  price: number
  quantity: number
  photo?: string | null
}

function storageKey(slug: string) {
  return `precy-catalogo-cart-${slug}`
}

function sameLine(item: CartItem, productId: string, variantId?: string | null) {
  return item.productId === productId && (item.variantId ?? null) === (variantId ?? null)
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
      const existing = prev.find(i => sameLine(i, item.productId, item.variantId))
      const next = existing
        ? prev.map(i => sameLine(i, item.productId, item.variantId) ? { ...i, quantity: i.quantity + item.quantity } : i)
        : [...prev, item]
      try { localStorage.setItem(storageKey(slug), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [slug])

  const updateQty = useCallback((productId: string, variantId: string | null | undefined, quantity: number) => {
    setItems(prev => {
      const next = quantity <= 0
        ? prev.filter(i => !sameLine(i, productId, variantId))
        : prev.map(i => sameLine(i, productId, variantId) ? { ...i, quantity } : i)
      try { localStorage.setItem(storageKey(slug), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [slug])

  const removeItem = useCallback((productId: string, variantId?: string | null) => updateQty(productId, variantId, 0), [updateQty])
  const clear = useCallback(() => persist([]), [persist])

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)

  return { items, addItem, updateQty, removeItem, clear, total }
}
