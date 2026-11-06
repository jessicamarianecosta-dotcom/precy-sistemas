'use client'

import { useEffect, useState, useCallback } from 'react'

/**
 * Estado compartilhado entre as 4 etapas do checkout da loja (Cadastro,
 * Produto e Arte, Entrega, Pagamento). Persistido em localStorage por loja
 * para o cliente poder navegar entre etapas (inclusive voltar) sem perder
 * o que já preencheu — nunca é limpo ao trocar de etapa, só em clear()
 * depois que o pedido é efetivamente criado.
 */
export const CHECKOUT_STEPS = ['cadastro', 'produto_arte', 'entrega', 'pagamento'] as const
export type CheckoutStep = typeof CHECKOUT_STEPS[number]

export const CHECKOUT_STEP_LABELS: Record<CheckoutStep, string> = {
  cadastro: 'Cadastro',
  produto_arte: 'Produto e arte',
  entrega: 'Entrega',
  pagamento: 'Pagamento',
}

export interface CheckoutCustomer {
  name: string
  phone: string
  email: string
  cpfCnpj: string
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  notes: string
}

export type FulfillmentMethod = 'shipping' | 'pickup'
export type PickupChoice = 'self' | 'uber_flash'

export interface CheckoutShippingSelection {
  service: string
  carrier?: string | null
  price: number
  days: number
}

export interface CheckoutState {
  step: CheckoutStep
  customer: CheckoutCustomer
  fulfillmentMethod: FulfillmentMethod | null
  pickupChoice: PickupChoice | null
  shipping: CheckoutShippingSelection | null
}

const EMPTY_CUSTOMER: CheckoutCustomer = {
  name: '', phone: '', email: '', cpfCnpj: '',
  cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
  notes: '',
}

const EMPTY_STATE: CheckoutState = {
  step: 'cadastro',
  customer: EMPTY_CUSTOMER,
  fulfillmentMethod: null,
  pickupChoice: null,
  shipping: null,
}

function storageKey(slug: string) {
  return `precy-catalogo-checkout-${slug}`
}

export function useCheckoutState(slug: string) {
  const [state, setState] = useState<CheckoutState>(EMPTY_STATE)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(slug))
      if (raw) {
        const parsed = JSON.parse(raw)
        setState({
          step: CHECKOUT_STEPS.includes(parsed.step) ? parsed.step : 'cadastro',
          customer: { ...EMPTY_CUSTOMER, ...(parsed.customer ?? {}) },
          fulfillmentMethod: parsed.fulfillmentMethod ?? null,
          pickupChoice: parsed.pickupChoice ?? null,
          shipping: parsed.shipping ?? null,
        })
      }
    } catch { /* ignore */ }
    setHydrated(true)
  }, [slug])

  const persist = useCallback((next: CheckoutState) => {
    setState(next)
    try { localStorage.setItem(storageKey(slug), JSON.stringify(next)) } catch { /* ignore */ }
  }, [slug])

  const patchCustomer = useCallback((patch: Partial<CheckoutCustomer>) => {
    setState(prev => {
      const next = { ...prev, customer: { ...prev.customer, ...patch } }
      try { localStorage.setItem(storageKey(slug), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [slug])

  const setStep = useCallback((step: CheckoutStep) => {
    setState(prev => {
      const next = { ...prev, step }
      try { localStorage.setItem(storageKey(slug), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [slug])

  const setFulfillment = useCallback((fulfillmentMethod: FulfillmentMethod | null, pickupChoice: PickupChoice | null = null) => {
    setState(prev => {
      const next = { ...prev, fulfillmentMethod, pickupChoice }
      try { localStorage.setItem(storageKey(slug), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [slug])

  const setShipping = useCallback((shipping: CheckoutShippingSelection | null) => {
    setState(prev => {
      const next = { ...prev, shipping }
      try { localStorage.setItem(storageKey(slug), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [slug])

  const goToIndex = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(CHECKOUT_STEPS.length - 1, index))
    setStep(CHECKOUT_STEPS[clamped])
  }, [setStep])

  const goNext = useCallback(() => {
    const idx = CHECKOUT_STEPS.indexOf(state.step)
    goToIndex(idx + 1)
  }, [state.step, goToIndex])

  const goBack = useCallback(() => {
    const idx = CHECKOUT_STEPS.indexOf(state.step)
    goToIndex(idx - 1)
  }, [state.step, goToIndex])

  const reset = useCallback(() => {
    persist(EMPTY_STATE)
  }, [persist])

  return {
    hydrated,
    step: state.step,
    stepIndex: CHECKOUT_STEPS.indexOf(state.step),
    customer: state.customer,
    fulfillmentMethod: state.fulfillmentMethod,
    pickupChoice: state.pickupChoice,
    shipping: state.shipping,
    patchCustomer,
    setStep,
    setFulfillment,
    setShipping,
    goToIndex,
    goNext,
    goBack,
    reset,
  }
}
