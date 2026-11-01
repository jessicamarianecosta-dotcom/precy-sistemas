'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import Script from 'next/script'
import { useQuery } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/utils/format'
import { QrCode, CreditCard, Loader2 } from 'lucide-react'

interface PaymentOptions {
  pixEnabled: boolean
  cardEnabled: boolean
  maxInstallments: number
  publicKey: string | null
  pix: { amount: number } | null
  card: Array<{ installments: number; installmentAmount: number; totalAmount: number }>
}

export interface PaymentPayload {
  method: 'pix' | 'credit_card'
  installments?: number
  cardToken?: string
  paymentMethodId?: string
}

export interface PaymentMethodSelectorHandle {
  /** Monta o payload pronto para /api/loja/checkout — tokeniza o cartão aqui se preciso. Lança erro com mensagem amigável se faltar algo. */
  resolvePayment(): Promise<PaymentPayload>
  hasOnlinePayment: boolean
}

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, opts?: Record<string, unknown>) => {
      createCardToken: (data: Record<string, unknown>) => Promise<{ id: string }>
      getPaymentMethods: (data: { bin: string }) => Promise<{ results: Array<{ id: string }> }>
    }
  }
}

/**
 * Seleção de forma de pagamento do checkout do catálogo — preço de cada
 * modalidade vem SEMPRE do servidor (/api/loja/pagamentos/opcoes), nunca
 * calculado no client, para nunca mostrar um valor diferente do que será
 * cobrado de fato. A tokenização do cartão usa o SDK oficial do Mercado
 * Pago (MP.js) com a chave PÚBLICA da própria loja — o número do cartão
 * nunca passa pelo nosso servidor, só o token resultante.
 */
export const PaymentMethodSelector = forwardRef<PaymentMethodSelectorHandle, { slug: string; amount: number }>(
  function PaymentMethodSelector({ slug, amount }, ref) {
    const [method, setMethod] = useState<'pix' | 'credit_card'>('pix')
    const [installments, setInstallments] = useState(1)
    const [sdkReady, setSdkReady] = useState(false)
    const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '', doc: '' })
    const mpRef = useRef<InstanceType<NonNullable<Window['MercadoPago']>> | null>(null)

    const { data, isLoading } = useQuery<PaymentOptions>({
      queryKey: ['loja-payment-options', slug, amount],
      enabled: amount > 0,
      queryFn: async () => {
        const res = await fetch(`/api/loja/pagamentos/opcoes?slug=${encodeURIComponent(slug)}&amount=${amount}`)
        if (!res.ok) throw new Error('Erro ao consultar formas de pagamento')
        return res.json()
      },
    })

    useEffect(() => {
      if (!data?.pixEnabled && data?.cardEnabled) setMethod('credit_card')
    }, [data])

    useEffect(() => {
      if (sdkReady && data?.publicKey && window.MercadoPago && !mpRef.current) {
        mpRef.current = new window.MercadoPago(data.publicKey, { locale: 'pt-BR' })
      }
    }, [sdkReady, data?.publicKey])

    useImperativeHandle(ref, () => ({
      hasOnlinePayment: !!(data?.pixEnabled || data?.cardEnabled),
      async resolvePayment(): Promise<PaymentPayload> {
        if (method === 'pix') return { method: 'pix' }

        if (!mpRef.current) throw new Error('Pagamento por cartão ainda carregando — aguarde um instante e tente novamente.')
        const [expMonth, expYear] = card.expiry.split('/').map(s => s.trim())
        if (!card.number || !card.name || !expMonth || !expYear || !card.cvv) {
          throw new Error('Preencha todos os dados do cartão')
        }
        const bin = card.number.replace(/\D/g, '').slice(0, 6)
        const methods = await mpRef.current.getPaymentMethods({ bin })
        const paymentMethodId = methods.results?.[0]?.id
        if (!paymentMethodId) throw new Error('Não foi possível identificar a bandeira do cartão')

        const token = await mpRef.current.createCardToken({
          cardNumber: card.number.replace(/\D/g, ''),
          cardholderName: card.name,
          cardExpirationMonth: expMonth,
          cardExpirationYear: expYear.length === 2 ? `20${expYear}` : expYear,
          securityCode: card.cvv,
          identificationType: card.doc.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF',
          identificationNumber: card.doc.replace(/\D/g, ''),
        })

        return { method: 'credit_card', installments, cardToken: token.id, paymentMethodId }
      },
    }), [method, card, installments, data])

    if (amount <= 0) return null
    if (isLoading) return <div className="card p-4 text-sm text-text-muted">Carregando formas de pagamento…</div>
    if (!data || (!data.pixEnabled && !data.cardEnabled)) {
      return (
        <div className="card p-4 text-sm text-text-muted">
          Esta loja ainda não habilitou pagamento online — finalize pelo WhatsApp.
        </div>
      )
    }

    return (
      <div className="card p-4 space-y-3">
        {data.publicKey && (
          <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onReady={() => setSdkReady(true)} />
        )}
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Forma de pagamento</h3>

        <div className="flex gap-2">
          {data.pixEnabled && (
            <button
              type="button"
              onClick={() => setMethod('pix')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border-2 ${
                method === 'pix' ? 'border-primary bg-primary-50 dark:bg-primary/10 text-primary' : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400'
              }`}
            >
              <QrCode size={15} /> Pix
            </button>
          )}
          {data.cardEnabled && (
            <button
              type="button"
              onClick={() => setMethod('credit_card')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border-2 ${
                method === 'credit_card' ? 'border-primary bg-primary-50 dark:bg-primary/10 text-primary' : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400'
              }`}
            >
              <CreditCard size={15} /> Cartão
            </button>
          )}
        </div>

        {method === 'pix' && data.pix && (
          <p className="text-sm text-text-secondary dark:text-stone-400">
            Total no Pix: <span className="font-bold text-text-primary dark:text-stone-100">{formatCurrency(data.pix.amount)}</span> — pagamento confirmado em poucos segundos.
          </p>
        )}

        {method === 'credit_card' && (
          <div className="space-y-3">
            {data.card.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {data.card.map(opt => (
                  <button
                    key={opt.installments}
                    type="button"
                    onClick={() => setInstallments(opt.installments)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                      installments === opt.installments ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400'
                    }`}
                  >
                    {opt.installments}x de {formatCurrency(opt.installmentAmount)}
                  </button>
                ))}
              </div>
            )}
            {data.card.find(o => o.installments === installments) && (
              <p className="text-xs text-text-muted">
                Total: {formatCurrency(data.card.find(o => o.installments === installments)!.totalAmount)}
                {installments > 1 && ' (sem juros ocultos — acréscimo já incluso no valor exibido)'}
              </p>
            )}

            <input className="input" placeholder="Número do cartão" inputMode="numeric" maxLength={19}
              value={card.number} onChange={e => setCard({ ...card, number: e.target.value })} />
            <input className="input" placeholder="Nome impresso no cartão"
              value={card.name} onChange={e => setCard({ ...card, name: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <input className="input col-span-1" placeholder="MM/AA" maxLength={5}
                value={card.expiry} onChange={e => setCard({ ...card, expiry: e.target.value })} />
              <input className="input col-span-1" placeholder="CVV" inputMode="numeric" maxLength={4}
                value={card.cvv} onChange={e => setCard({ ...card, cvv: e.target.value })} />
              <input className="input col-span-1" placeholder="CPF do titular" inputMode="numeric"
                value={card.doc} onChange={e => setCard({ ...card, doc: e.target.value })} />
            </div>
            {!sdkReady && <p className="text-[11px] text-text-muted flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Carregando pagamento seguro…</p>}
          </div>
        )}
      </div>
    )
  }
)
