'use client'
import { useState } from 'react'
import { useSubscription } from './useSubscription'

export function usePlanGuard() {
  const { data: sub } = useSubscription()
  const [upgradeOpen,  setUpgradeOpen]  = useState(false)
  const [upgradeReason, setUpgradeReason] = useState('')

  function requirePro(reason?: string): boolean {
    if (sub?.isPro) return true
    setUpgradeReason(reason ?? 'Este recurso está disponível apenas no plano Pro.')
    setUpgradeOpen(true)
    return false
  }

  function checkLimit(type: 'products' | 'orders', count: number): boolean {
    const limit = sub?.limits[type] ?? 20
    if (count < limit) return true
    const labels = { products: 'produtos', orders: 'pedidos' }
    setUpgradeReason(
      `Você atingiu o limite de ${limit} ${labels[type]} no plano Basic. Assine o Pro para ter acesso ilimitado.`
    )
    setUpgradeOpen(true)
    return false
  }

  return { sub, upgradeOpen, upgradeReason, setUpgradeOpen, requirePro, checkLimit }
}
