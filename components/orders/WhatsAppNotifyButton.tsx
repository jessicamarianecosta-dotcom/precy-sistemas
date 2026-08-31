'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, X, Loader2, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { formatCurrency } from '@/lib/utils/format'
import {
  normalizePhoneToWhatsapp, buildOrderReadyMessage, openWhatsappConversation,
} from '@/lib/orders/whatsapp'

interface WhatsAppNotifyButtonProps {
  orderId: string
  orderNumber: string | null
  orderTotal: number
  customer: { id: string; name: string; phone: string | null } | null
  companyAddress?: string | null
  companyId: string
  whatsappNotifiedAt?: string | null
  variant?: 'icon' | 'full'
  className?: string
  onNotified?: () => void
}

/**
 * Botão "Avisar cliente pelo WhatsApp" — abre o wa.me com a mensagem de
 * pedido pronto já preenchida. Nunca envia nada automaticamente: só
 * registra que o link foi aberto (whatsapp_notified_at/count).
 */
export function WhatsAppNotifyButton({
  orderId, orderNumber, orderTotal, customer, companyAddress, companyId,
  whatsappNotifiedAt, variant = 'icon', className, onNotified,
}: WhatsAppNotifyButtonProps) {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState<{ phoneDigits: string; message: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleOpen() {
    if (!customer) {
      setErrorMsg('Este pedido não possui um cliente vinculado.')
      return
    }
    if (!customer.phone || !customer.phone.trim()) {
      setErrorMsg('Este cliente não possui um número de WhatsApp cadastrado.')
      return
    }
    const phoneDigits = normalizePhoneToWhatsapp(customer.phone)
    if (!phoneDigits) {
      setErrorMsg('Não foi possível utilizar este número para abrir o WhatsApp. Verifique o telefone cadastrado.')
      return
    }

    setLoading(true)
    try {
      const { data: history } = await (supabase.from('payment_history') as any)
        .select('amount')
        .eq('order_id', orderId)
        .eq('company_id', companyId)
      const received = (history ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0)
      const pendingAmount = Math.max(0, Number(orderTotal) - received)

      const message = buildOrderReadyMessage({
        customerName: customer.name,
        orderNumber,
        companyAddress: companyAddress || null,
        pendingAmount,
      })

      setConfirm({ phoneDigits, message })
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!confirm) return

    // Registra o aviso antes de abrir o WhatsApp: no Android a abertura é uma
    // navegação top-level (Intent URL) e o código abaixo não rodaria depois.
    const { data } = await (supabase.from('orders') as any)
      .select('whatsapp_notification_count')
      .eq('id', orderId)
      .single()

    await (supabase.from('orders') as any)
      .update({
        whatsapp_notified_at: new Date().toISOString(),
        whatsapp_notification_count: (Number(data?.whatsapp_notification_count) || 0) + 1,
      })
      .eq('id', orderId)

    toast('success', 'WhatsApp aberto para envio.')
    setConfirm(null)
    onNotified?.()

    openWhatsappConversation(confirm.phoneDigits, confirm.message)
  }

  const label = whatsappNotifiedAt
    ? `📲 Último aviso: ${format(new Date(whatsappNotifiedAt), "dd/MM 'às' HH:mm", { locale: ptBR })}`
    : '📲 Avisar cliente'

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleOpen() }}
          disabled={loading}
          className={clsx(
            'p-1.5 rounded-lg text-success hover:bg-success-light dark:hover:bg-success/10 transition-colors disabled:opacity-50',
            className
          )}
          title={label}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <MessageCircle size={12} />}
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleOpen() }}
          disabled={loading}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-success hover:opacity-90 transition-opacity disabled:opacity-50',
            className
          )}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
          {label}
        </button>
      )}

      {/* Erro: cliente sem telefone / sem cliente / telefone inválido */}
      {errorMsg && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setErrorMsg(null)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm p-5 animate-scaleIn">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-warning-light dark:bg-warning/10 text-warning flex-shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary dark:text-stone-100">Não foi possível avisar o cliente</p>
                <p className="text-xs text-text-muted dark:text-stone-400 mt-1">{errorMsg}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setErrorMsg(null)} className="btn-secondary flex-1 text-xs">
                Fechar
              </button>
              {errorMsg.includes('WhatsApp cadastrado') && (
                <button
                  type="button"
                  onClick={() => { setErrorMsg(null); router.push('/clientes') }}
                  className="btn-primary flex-1 text-xs"
                >
                  Cadastrar telefone
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmação antes de abrir o WhatsApp */}
      {confirm && customer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm p-5 animate-scaleIn">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 flex items-center gap-2">
                <MessageCircle size={16} className="text-success" /> Avisar cliente?
              </h3>
              <button type="button" onClick={() => setConfirm(null)} className="p-1 rounded-lg text-text-muted hover:bg-primary-50 dark:hover:bg-white/5">
                <X size={14} />
              </button>
            </div>
            <p className="text-xs text-text-muted dark:text-stone-400 mb-3">
              Enviar mensagem pelo WhatsApp para:
            </p>
            <div className="rounded-xl border border-border dark:border-border-dark p-3 text-xs space-y-1 mb-4">
              <p className="font-semibold text-text-primary dark:text-stone-100">{customer.name}</p>
              <p className="text-text-muted dark:text-stone-400">{customer.phone}</p>
              <p className="text-text-muted dark:text-stone-400">Pedido: #{orderNumber || '—'} · {formatCurrency(orderTotal)}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="btn-secondary flex-1 text-xs">
                Cancelar
              </button>
              <button type="button" onClick={handleConfirm} className="btn-primary flex-1 text-xs flex items-center justify-center gap-1.5">
                <MessageCircle size={13} /> Abrir WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
