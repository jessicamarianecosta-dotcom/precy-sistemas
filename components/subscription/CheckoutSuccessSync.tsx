'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Monta em todo o dashboard (ver app/(dashboard)/layout.tsx). Quando o
 * usuário volta do Stripe Checkout (?checkout=success, do
 * /api/stripe/checkout-return) ou troca de plano numa assinatura já ativa
 * (?planChanged=success), invalida o cache do useSubscription — sem isso
 * o React Query só refetch sozinho depois de staleTime (5min), e a UI
 * continuaria mostrando plano/status antigos mesmo com o middleware já
 * liberando a navegação. router.refresh() também força os Server
 * Components da rota a rebuscar dado novo. Tudo sem precisar de reload
 * manual, logout ou novo login.
 */
export function CheckoutSuccessSync() {
  const router       = useRouter()
  const pathname      = usePathname()
  const searchParams = useSearchParams()
  const queryClient  = useQueryClient()

  useEffect(() => {
    const justPaid = searchParams.get('checkout') === 'success' || searchParams.get('planChanged') === 'success'
    if (!justPaid) return

    queryClient.invalidateQueries({ queryKey: ['subscription'] })
    router.refresh()

    // Limpa o parâmetro da URL pra não invalidar de novo em cada refresh
    // manual da página.
    const params = new URLSearchParams(searchParams.toString())
    params.delete('checkout')
    params.delete('planChanged')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return null
}
