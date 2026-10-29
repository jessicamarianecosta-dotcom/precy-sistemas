'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Package, Truck, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'

interface OrderItem {
  name: string
  variant_label: string | null
  quantity: number
  unit_price: number
  subtotal: number
  variant_photo: string | null
}

interface OrderSummary {
  id: string
  order_number: string
  status: string
  payment_status: string
  subtotal: number
  delivery_fee: number
  total: number
  shipping_service: string | null
  shipping_days: number | null
  tracking_code: string | null
  created_at: string
  delivery_city: string | null
  delivery_state: string | null
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', production: 'Em produção', ready: 'Pronto para envio',
  delivered: 'Entregue', cancelled: 'Cancelado',
}

const PAYMENT_LABELS: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: 'Aguardando pagamento', icon: Clock, className: 'text-warning' },
  paid: { label: 'Pagamento confirmado', icon: CheckCircle2, className: 'text-success' },
  failed: { label: 'Pagamento recusado', icon: XCircle, className: 'text-error' },
}

export default function PedidoAcompanhamentoPage() {
  const { slug, ref } = useParams<{ slug: string; ref: string }>()

  const { data, isLoading, error } = useQuery<{ order: OrderSummary; items: OrderItem[] }>({
    queryKey: ['loja-pedido', ref],
    queryFn: async () => {
      const res = await fetch(`/api/loja/pedido/${ref}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Pedido não encontrado')
      return json
    },
    refetchInterval: 15000,
  })

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark">
      <div className="max-w-xl mx-auto px-4 py-6">
        <Link href={`/loja/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary mb-4">
          <ArrowLeft size={15} /> Voltar para a loja
        </Link>

        {isLoading && <p className="text-sm text-text-muted">Carregando pedido…</p>}
        {error && <p className="text-sm text-error">{(error as Error).message}</p>}

        {data && (() => {
          const { order, items } = data
          const payment = PAYMENT_LABELS[order.payment_status] ?? PAYMENT_LABELS.pending
          const PaymentIcon = payment.icon
          return (
            <div className="space-y-5">
              <div className="card p-4">
                <h1 className="text-lg font-bold text-text-primary dark:text-stone-100">Pedido {order.order_number}</h1>
                <p className="text-xs text-text-muted mt-0.5">
                  Feito em {new Date(order.created_at).toLocaleDateString('pt-BR')}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <PaymentIcon size={16} className={payment.className} />
                  <span className={`text-sm font-medium ${payment.className}`}>{payment.label}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <Package size={16} className="text-text-muted" />
                  <span className="text-sm text-text-secondary dark:text-stone-400">
                    Situação do pedido: <b className="text-text-primary dark:text-stone-100">{STATUS_LABELS[order.status] ?? order.status}</b>
                  </span>
                </div>
                {order.shipping_service && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <Truck size={16} className="text-text-muted" />
                    <span className="text-sm text-text-secondary dark:text-stone-400">
                      Entrega: <b className="text-text-primary dark:text-stone-100">{order.shipping_service}</b>
                      {order.shipping_days ? ` · ${order.shipping_days} dia(s)` : ''}
                      {order.delivery_city ? ` · ${order.delivery_city}/${order.delivery_state}` : ''}
                    </span>
                  </div>
                )}
                {order.tracking_code && (
                  <p className="text-xs text-text-muted mt-2">Rastreamento: <b className="text-text-primary dark:text-stone-100">{order.tracking_code}</b></p>
                )}
              </div>

              <div className="card divide-y divide-border dark:divide-border-dark">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3">
                    <div className="relative w-12 h-12 rounded-lg bg-surface dark:bg-white/5 overflow-hidden flex-shrink-0">
                      {item.variant_photo && <Image src={item.variant_photo} alt="" fill sizes="48px" className="object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">{item.name}</p>
                      {item.variant_label && <p className="text-[11px] text-text-muted truncate">{item.variant_label}</p>}
                      <p className="text-xs text-text-muted">{item.quantity}x {formatCurrency(item.unit_price)}</p>
                    </div>
                    <p className="text-sm font-semibold text-text-primary dark:text-stone-100">{formatCurrency(item.subtotal)}</p>
                  </div>
                ))}
              </div>

              <div className="card p-4 space-y-1.5">
                <div className="flex justify-between text-sm text-text-secondary dark:text-stone-400">
                  <span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-text-secondary dark:text-stone-400">
                  <span>Frete</span><span>{formatCurrency(order.delivery_fee)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-text-primary dark:text-stone-100 pt-1.5 border-t border-border dark:border-border-dark">
                  <span>Total</span><span>{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
