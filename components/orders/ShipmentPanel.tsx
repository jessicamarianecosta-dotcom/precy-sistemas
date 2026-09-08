'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Truck, Loader2, Printer, ExternalLink, PackageCheck, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/Toaster'

interface Props {
  orderId: string
  companyId: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', generated: 'Etiqueta gerada', posted: 'Postado',
  in_transit: 'Em trânsito', delivered: 'Entregue', problem: 'Problema no envio', cancelled: 'Cancelado',
}

/**
 * Envio/etiqueta do pedido — só para pedidos do Catálogo Online (source
 * 'catalog'), pagos, ainda sem etiqueta gerada. Nunca permite gerar uma
 * segunda etiqueta para o mesmo pedido (order_shipments.order_id é
 * UNIQUE — a API já bloqueia isso, este painel só reflete o estado real).
 */
export function ShipmentPanel({ orderId, companyId }: Props) {
  const supabase = createClient()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: order, isLoading: loadingOrder } = useQuery({
    queryKey: ['order-shipment-order', orderId],
    queryFn: async () => {
      const { data } = await (supabase.from('orders') as any)
        .select('id, source, payment_status, order_number, shipping_service')
        .eq('id', orderId)
        .eq('company_id', companyId)
        .maybeSingle()
      return data
    },
  })

  const { data: shipment, isLoading: loadingShipment } = useQuery({
    queryKey: ['order-shipment', orderId],
    enabled: !!order,
    queryFn: async () => {
      const { data } = await (supabase.from('order_shipments') as any)
        .select('*')
        .eq('order_id', orderId)
        .eq('company_id', companyId)
        .maybeSingle()
      return data
    },
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/pedidos/${orderId}/etiqueta`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar etiqueta')
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['order-shipment', orderId] })
      toast('success', data.alreadyExisted ? 'Etiqueta já existia para este pedido.' : 'Etiqueta gerada com sucesso!')
    },
    onError: (err: Error) => toast('error', err.message),
  })

  if (order?.source !== 'catalog') return null
  if (loadingOrder || loadingShipment) {
    return <section className="text-sm text-text-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando envio…</section>
  }

  return (
    <section className="space-y-2.5">
      <h3 className="text-sm font-semibold text-text-primary dark:text-stone-200 flex items-center gap-1.5">
        <Truck size={15} /> Envio
      </h3>

      {shipment ? (
        <div className="rounded-xl border border-border dark:border-border-dark p-3.5 space-y-2 bg-surface/50 dark:bg-white/5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary dark:text-stone-100">{shipment.service_name || 'Envio'}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {STATUS_LABELS[shipment.status] ?? shipment.status}
            </span>
          </div>
          {shipment.tracking_code && (
            <p className="text-xs text-text-secondary dark:text-stone-400">
              Rastreio: <span className="font-mono font-medium">{shipment.tracking_code}</span>
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {shipment.label_url && (
              <>
                <a href={shipment.label_url} target="_blank" rel="noreferrer" className="btn-secondary !text-xs !py-1.5 !px-3 flex items-center gap-1.5">
                  <ExternalLink size={13} /> Visualizar etiqueta
                </a>
                <a href={shipment.label_url} target="_blank" rel="noreferrer" className="btn-secondary !text-xs !py-1.5 !px-3 flex items-center gap-1.5">
                  <Printer size={13} /> Imprimir
                </a>
              </>
            )}
            {shipment.tracking_url && (
              <a href={shipment.tracking_url} target="_blank" rel="noreferrer" className="btn-secondary !text-xs !py-1.5 !px-3 flex items-center gap-1.5">
                <PackageCheck size={13} /> Rastrear
              </a>
            )}
          </div>
        </div>
      ) : order.payment_status !== 'paid' ? (
        <p className="text-xs text-text-muted flex items-center gap-1.5">
          <AlertCircle size={13} /> Disponível assim que o pagamento for confirmado.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="btn-primary !text-sm flex items-center gap-2"
        >
          {generateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
          {generateMutation.isPending ? 'Gerando etiqueta…' : 'Gerar etiqueta'}
        </button>
      )}
    </section>
  )
}
