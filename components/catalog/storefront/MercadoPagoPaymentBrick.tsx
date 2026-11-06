'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { loadMercadoPagoSdk } from '@/lib/catalog/loadMercadoPagoSdk'
import { useToast } from '@/components/ui/Toaster'

export interface BrickPaymentSubmission {
  method: 'pix' | 'card'
  token?: string
  installments?: number
  paymentMethodId?: string
  issuerId?: string | null
  payerEmail?: string
  docType?: string
  docNumber?: string
}

export interface BrickPaymentResult {
  checkoutRef: string
  orderNumber: string
  paymentId: string
  status: 'pending' | 'paid' | 'failed'
  statusDetail?: string | null
}

interface Props {
  publicKey: string
  amount: number
  payerEmail?: string
  onSubmitPayment: (payload: BrickPaymentSubmission) => Promise<BrickPaymentResult>
  onConfirmed: (checkoutRef: string, orderNumber: string) => void
}

/**
 * Seção de pagamento do checkout da loja — Pix e cartão de crédito, únicos
 * meios oferecidos (customization.paymentMethods abaixo exclui boleto,
 * cartão pré-pago/débito e saldo em conta Mercado Pago). Usa o Payment Brick
 * do Mercado Pago para a entrada dos dados (nunca coletamos cartão
 * diretamente) e o Status Screen Brick para mostrar QR/código Pix e status
 * em tempo real após o envio — ambos oficiais, sem UI própria recriando o
 * que os Bricks já fazem.
 */
export function MercadoPagoPaymentBrick({ publicKey, amount, payerEmail, onSubmitPayment, onConfirmed }: Props) {
  const { toast } = useToast()
  const [stage, setStage] = useState<'loading' | 'brick' | 'status' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [checkoutRef, setCheckoutRef] = useState<string | null>(null)
  const paymentControllerRef = useRef<any>(null)
  const statusControllerRef = useRef<any>(null)
  const mpRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false
    loadMercadoPagoSdk()
      .then(() => {
        if (cancelled) return
        mpRef.current = new window.MercadoPago!(publicKey, { locale: 'pt-BR' })
        setStage('brick')
      })
      .catch(err => {
        if (cancelled) return
        setErrorMsg(err.message)
        setStage('error')
      })
    return () => { cancelled = true }
  }, [publicKey])

  // Monta o Payment Brick assim que o SDK estiver pronto.
  useEffect(() => {
    if (stage !== 'brick' || !mpRef.current) return
    let unmounted = false

    const settings = {
      initialization: {
        amount,
        payer: payerEmail ? { email: payerEmail } : undefined,
      },
      customization: {
        paymentMethods: {
          creditCard: 'all',
          bankTransfer: 'all',
          ticket: 'none',
          prepaidCard: 'none',
          debitCard: 'none',
          mercadoPago: 'none',
        },
      },
      callbacks: {
        onReady: () => {},
        onError: (error: any) => {
          console.error('[MercadoPagoPaymentBrick] erro no Payment Brick:', error)
        },
        onSubmit: ({ selectedPaymentMethod, formData }: any) => {
          return new Promise<void>((resolve, reject) => {
            const method: 'pix' | 'card' = selectedPaymentMethod === 'bank_transfer' ? 'pix' : 'card'
            onSubmitPayment({
              method,
              token: formData?.token,
              installments: formData?.installments,
              paymentMethodId: formData?.payment_method_id,
              issuerId: formData?.issuer_id ?? null,
              payerEmail: formData?.payer?.email,
              docType: formData?.payer?.identification?.type,
              docNumber: formData?.payer?.identification?.number,
            })
              .then(result => {
                if (unmounted) { resolve(); return }
                if (result.status === 'failed') {
                  toast('error', result.statusDetail ?? 'Pagamento recusado. Verifique os dados e tente novamente.')
                  reject(new Error('payment_failed'))
                  return
                }
                setPaymentId(result.paymentId)
                setCheckoutRef(result.checkoutRef)
                setStage('status')
                resolve()
              })
              .catch(err => {
                toast('error', err?.message ?? 'Não foi possível iniciar o pagamento')
                reject(err)
              })
          })
        },
      },
    }

    mpRef.current.bricks().create('payment', 'mp-payment-brick', settings).then((controller: any) => {
      if (unmounted) { controller.unmount(); return }
      paymentControllerRef.current = controller
    })

    return () => {
      unmounted = true
      paymentControllerRef.current?.unmount()
      paymentControllerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // Monta o Status Screen Brick quando o pagamento foi criado — ele já exibe
  // o QR/código Pix para copiar e o status em tempo real, nativamente.
  useEffect(() => {
    if (stage !== 'status' || !mpRef.current || !paymentId) return
    let unmounted = false

    mpRef.current.bricks().create('statusScreen', 'mp-status-brick', {
      initialization: { paymentId },
      callbacks: {
        onReady: () => {},
        onError: (error: any) => console.error('[MercadoPagoPaymentBrick] erro no Status Screen Brick:', error),
      },
    }).then((controller: any) => {
      if (unmounted) { controller.unmount(); return }
      statusControllerRef.current = controller
    })

    return () => {
      unmounted = true
      statusControllerRef.current?.unmount()
      statusControllerRef.current = null
    }
  }, [stage, paymentId])

  // Enquanto o Status Screen é exibido, confirma com o NOSSO backend quando o
  // webhook já processou o pagamento (o Status Screen só reflete o lado do
  // Mercado Pago — o pedido só é considerado pago de fato após a cascata do
  // webhook, ver app/api/webhooks/mercadopago/route.ts).
  useEffect(() => {
    if (stage !== 'status' || !checkoutRef) return
    let cancelled = false

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/loja/pedido/${checkoutRef}`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data?.order?.payment_status === 'paid') {
          clearInterval(interval)
          onConfirmed(checkoutRef, data.order.order_number)
        }
      } catch {
        // falha de rede pontual — tenta de novo no próximo ciclo
      }
    }, 4000)

    return () => { cancelled = true; clearInterval(interval) }
  }, [stage, checkoutRef, onConfirmed])

  if (stage === 'error') {
    return <p className="text-sm text-error">{errorMsg}</p>
  }

  return (
    <div className="space-y-3">
      {stage === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-8 text-text-muted text-sm">
          <Loader2 size={16} className="animate-spin" /> Carregando pagamento…
        </div>
      )}
      <div id="mp-payment-brick" className={stage === 'brick' ? '' : 'hidden'} />
      {stage === 'status' && (
        <div className="space-y-2">
          <div id="mp-status-brick" />
          <p className="text-xs text-text-muted text-center">
            Assim que o pagamento for confirmado, seu pedido será atualizado automaticamente.
          </p>
        </div>
      )}
    </div>
  )
}
