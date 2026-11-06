'use client'

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, opts?: { locale?: string }) => any
  }
}

let loadPromise: Promise<void> | null = null

/** Carrega o SDK oficial do Mercado Pago (Checkout Bricks) uma única vez por página. */
export function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SDK do Mercado Pago só pode ser carregado no navegador'))
  if (window.MercadoPago) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => { loadPromise = null; reject(new Error('Falha ao carregar o Mercado Pago. Verifique sua conexão e tente novamente.')) }
    document.head.appendChild(script)
  })

  return loadPromise
}
