'use client'

import { useEffect, useRef, useState } from 'react'
import { Payment, initMercadoPago } from '@mercadopago/sdk-react'
import type { IPaymentFormData } from '@mercadopago/sdk-react/esm/bricks/payment/type'
import { Loader2, MessageCircle, ShieldCheck, Copy, Check, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { useToast } from '@/components/ui/Toaster'

export interface PendingOrder {
  orderId: string
  orderNumber: string
  checkoutRef: string
  total: number
}

export interface OnlinePaymentInfo {
  available: boolean
  publicKey?: string
  pixEnabled?: boolean
  cardEnabled?: boolean
  maxInstallments?: number
}

interface PaymentResultState {
  status: string
  pix?: { qrCode: string; qrCodeBase64: string; ticketUrl?: string | null } | null
}

interface StepPagamentoProps {
  slug: string
  customerEmail: string
  subtotal: number
  shippingPrice: number
  deliverySummary: string
  onlinePayment: OnlinePaymentInfo | undefined
  loadingOnlinePayment: boolean
  storeWhatsapp: string | null
  onCreateOnlineOrder: () => Promise<PendingOrder | null>
  onFinalizeWhatsapp: () => Promise<void>
  onPaid: (checkoutRef: string) => void
}

let mpInitializedWithKey: string | null = null

/**
 * Etapa 4 — Pagamento. Pix e cartão de crédito, inline, via Payment Brick
 * oficial do Mercado Pago (@mercadopago/sdk-react) — nunca redireciona para
 * fora do site. A confirmação do pagamento é sempre feita pelo webhook
 * (nunca por esta tela) — aqui só mostramos o status devolvido na hora
 * pela API e ficamos observando o pedido até ele mudar para "pago".
 */
export function StepPagamento({
  slug, customerEmail, subtotal, shippingPrice, deliverySummary,
  onlinePayment, loadingOnlinePayment, storeWhatsapp,
  onCreateOnlineOrder, onFinalizeWhatsapp, onPaid,
}: StepPagamentoProps) {
  const { toast } = useToast()
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null)
  const [startingOnline, setStartingOnline] = useState(false)
  const [submittingWhatsapp, setSubmittingWhatsapp] = useState(false)
  const [paymentResult, setPaymentResult] = useState<PaymentResultState | null>(null)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const total = pendingOrder?.total ?? (subtotal + shippingPrice)

  useEffect(() => {
    if (onlinePayment?.publicKey && mpInitializedWithKey !== onlinePayment.publicKey) {
      initMercadoPago(onlinePayment.publicKey, { locale: 'pt-BR' })
      mpInitializedWithKey = onlinePayment.publicKey
    }
  }, [onlinePayment?.publicKey])

  // Enquanto o pagamento não aparece como confirmado, observa o pedido
  // (mesma rota pública já usada na página de acompanhamento do pedido) —
  // é o webhook que muda isso, nunca esta tela.
  useEffect(() => {
    if (!pendingOrder || !paymentResult) return
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/loja/pedido/${pendingOrder.checkoutRef}`)
        if (!res.ok) return
        const data = await res.json()
        if (data?.order?.payment_status === 'paid') {
          if (pollRef.current) clearInterval(pollRef.current)
          onPaid(pendingOrder.checkoutRef)
        }
      } catch { /* mantém tentando */ }
    }, 4000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [pendingOrder, paymentResult, onPaid])

  async function handleStartOnline() {
    setStartingOnline(true)
    try {
      const order = await onCreateOnlineOrder()
      if (order) setPendingOrder(order)
    } finally {
      setStartingOnline(false)
    }
  }

  async function handleWhatsapp() {
    setSubmittingWhatsapp(true)
    try {
      await onFinalizeWhatsapp()
    } finally {
      setSubmittingWhatsapp(false)
    }
  }

  async function copyPixCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast('error', 'Não foi possível copiar — selecione e copie manualmente.')
    }
  }

  const paymentMethods: Record<string, 'all'> = {}
  if (onlinePayment?.cardEnabled) paymentMethods.creditCard = 'all'
  if (onlinePayment?.pixEnabled) paymentMethods.bankTransfer = 'all'

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-1.5">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--store-text)' }}>Resumo</h3>
        <p className="text-sm" style={{ color: 'var(--store-text-secondary)' }}>{deliverySummary}</p>
        <div className="flex justify-between text-sm pt-1" style={{ color: 'var(--store-text-secondary)' }}>
          <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm" style={{ color: 'var(--store-text-secondary)' }}>
          <span>Frete</span><span>{formatCurrency(shippingPrice)}</span>
        </div>
        <div className="flex justify-between text-base font-bold pt-1.5 border-t" style={{ color: 'var(--store-text)', borderColor: 'var(--store-border)' }}>
          <span>Total</span><span>{formatCurrency(total)}</span>
        </div>
      </div>

      {!pendingOrder && (
        <div className="space-y-2">
          {!loadingOnlinePayment && onlinePayment?.available && (
            <button
              type="button"
              disabled={startingOnline}
              onClick={handleStartOnline}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--store-primary)', color: 'var(--store-button-text)' }}
            >
              {startingOnline && <Loader2 size={15} className="animate-spin" />}
              Pagar com Pix ou cartão
            </button>
          )}
          {storeWhatsapp && (
            <button
              type="button"
              disabled={submittingWhatsapp}
              onClick={handleWhatsapp}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 transition-colors disabled:opacity-50"
            >
              {submittingWhatsapp ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={16} />}
              Finalizar pelo WhatsApp
            </button>
          )}
        </div>
      )}

      {pendingOrder && !paymentResult && processingPayment && (
        <div className="card p-6 flex flex-col items-center justify-center gap-2 text-center">
          <Loader2 size={22} className="animate-spin" style={{ color: 'var(--store-primary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--store-text)' }}>Gerando seu pagamento...</p>
        </div>
      )}

      {pendingOrder && !paymentResult && !processingPayment && (
        <div className="card p-3">
          <Payment
            initialization={{
              amount: pendingOrder.total,
              payer: customerEmail ? { email: customerEmail } : undefined,
            }}
            customization={{
              paymentMethods: paymentMethods as any,
              visual: { style: { theme: 'default' } },
            }}
            onSubmit={({ formData }: IPaymentFormData) => {
              // Mostra "Gerando seu pagamento..." no lugar do Brick assim que o
              // cliente confirma — sem isso, o intervalo entre clicar em
              // "Pagar" e o QR do Pix aparecer não tinha nenhum feedback visual.
              setProcessingPayment(true)
              return new Promise<void>((resolve, reject) => {
                fetch('/api/loja/pagamento', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ slug, checkoutRef: pendingOrder.checkoutRef, formData }),
                })
                  .then(async res => {
                    const data = await res.json()
                    if (!res.ok) {
                      toast('error', data.error ?? 'Não foi possível processar o pagamento')
                      setProcessingPayment(false)
                      reject(new Error(data.error ?? 'payment_failed'))
                      return
                    }
                    setPaymentResult({ status: data.status, pix: data.pix ?? null })
                    setProcessingPayment(false)
                    resolve()
                  })
                  .catch(() => {
                    toast('error', 'Erro de conexão ao processar o pagamento. Tente novamente.')
                    setProcessingPayment(false)
                    reject(new Error('network_error'))
                  })
              })
            }}
            onError={() => toast('error', 'Erro ao carregar o formulário de pagamento. Atualize a página.')}
          />
        </div>
      )}

      {paymentResult?.pix && (
        <div className="card p-4 space-y-3 text-center">
          <p className="text-sm font-semibold flex items-center justify-center gap-1.5" style={{ color: 'var(--store-text)' }}>
            <Clock size={15} /> Aguardando pagamento do Pix
          </p>
          {paymentResult.pix.qrCodeBase64 && (
            <img
              src={`data:image/png;base64,${paymentResult.pix.qrCodeBase64}`}
              alt="QR Code Pix"
              className="w-48 h-48 mx-auto rounded-lg border"
              style={{ borderColor: 'var(--store-border)' }}
            />
          )}
          <div className="flex items-center gap-2">
            <input readOnly value={paymentResult.pix.qrCode} className="input text-xs flex-1" onFocus={e => e.target.select()} />
            <button
              type="button"
              onClick={() => copyPixCode(paymentResult.pix!.qrCode)}
              className="btn-secondary shrink-0 flex items-center gap-1.5 text-xs"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--store-text-secondary)' }}>
            Abra o app do seu banco, escaneie o QR Code ou cole o código copia e cola. A confirmação é automática.
          </p>
        </div>
      )}

      {paymentResult && !paymentResult.pix && (
        <div className="card p-4 space-y-2 text-center">
          {['approved', 'in_process', 'pending'].includes(paymentResult.status) ? (
            <p className="text-sm font-semibold flex items-center justify-center gap-1.5" style={{ color: 'var(--store-text)' }}>
              <Loader2 size={15} className="animate-spin" /> Confirmando seu pagamento...
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold flex items-center justify-center gap-1.5 text-error">
                <XCircle size={15} /> Pagamento não aprovado
              </p>
              <button
                type="button"
                onClick={() => setPaymentResult(null)}
                className="text-xs font-medium hover:opacity-70"
                style={{ color: 'var(--store-primary)' }}
              >
                Tentar novamente
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex items-start gap-2 text-xs p-3 rounded-lg" style={{ backgroundColor: 'var(--store-surface)', color: 'var(--store-text-secondary)' }}>
        <ShieldCheck size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--store-primary)' }} />
        <span>
          <strong style={{ color: 'var(--store-text)' }}>Pagamento em ambiente seguro.</strong> Seus dados de pagamento são
          protegidos e processados pelo Mercado Pago, nosso provedor de pagamentos, por conexão segura (HTTPS). Nós não
          armazenamos os dados completos do seu cartão — a confirmação do pagamento é feita diretamente pelo gateway.
        </span>
      </div>
    </div>
  )
}
