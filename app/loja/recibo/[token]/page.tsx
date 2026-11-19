'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Download, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { generatePublicReceiptPDF } from '@/lib/pdf/generatePublicReceiptPDF'

interface ApiResponse {
  receipt: {
    amount: number; payment_date: string; payment_method: string | null
    payment_method_label: string; observation: string | null; issued_at: string
  }
  order: { order_number: string; service_name: string | null; total: number; balance_after: number }
  customer: { name: string | null; cpf_cnpj: string | null }
  company: {
    name: string; email: string | null; phone: string | null; cnpj: string | null
    logo_url: string | null; primary_color: string; secondary_color: string
  }
}

export default function ReciboPublicoPage() {
  const params = useParams()
  const token = String(params.token ?? '')

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ['loja-recibo', token],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`/api/loja/recibo/${token}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Recibo não encontrado')
      return json
    },
    retry: false,
  })

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-stone-500">Carregando…</div>
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 p-6 text-center">
        <AlertTriangle size={32} className="text-red-500" />
        <p className="text-sm text-stone-600 dark:text-stone-300">{(error as Error)?.message || 'Recibo não encontrado'}</p>
      </div>
    )
  }

  const { receipt, order, customer, company } = data

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 py-6 px-4">
      <div className="max-w-md mx-auto space-y-3">
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 shadow-sm text-center space-y-2">
          {company.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo_url} alt={company.name} className="h-12 mx-auto object-contain" />
          ) : (
            <div
              className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center text-white font-bold text-lg"
              style={{ background: company.primary_color }}
            >
              {company.name.charAt(0).toUpperCase()}
            </div>
          )}
          <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">{company.name}</p>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3 text-center text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5">
          <CheckCircle2 size={14} /> RECIBO DE PAGAMENTO
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 shadow-sm text-center space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Valor recebido</p>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(receipt.amount)}</p>

          <div className="pt-2 grid grid-cols-2 gap-2 text-xs text-left border-t border-stone-100 dark:border-stone-800 mt-2">
            <div>
              <p className="text-stone-400">Cliente</p>
              <p className="font-medium text-stone-700 dark:text-stone-200">{customer.name || '—'}</p>
            </div>
            <div>
              <p className="text-stone-400">Pedido</p>
              <p className="font-medium text-stone-700 dark:text-stone-200">{order.order_number}</p>
            </div>
            <div>
              <p className="text-stone-400">Data</p>
              <p className="font-medium text-stone-700 dark:text-stone-200">
                {new Date(receipt.payment_date + 'T00:00:00').toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div>
              <p className="text-stone-400">Forma de pagamento</p>
              <p className="font-medium text-stone-700 dark:text-stone-200">{receipt.payment_method_label}</p>
            </div>
          </div>

          <p className="pt-2 text-xs border-t border-stone-100 dark:border-stone-800 mt-2">
            {order.balance_after > 0 ? (
              <span className="text-amber-700 dark:text-amber-400 font-medium">
                Saldo restante do pedido: {formatCurrency(order.balance_after)}
              </span>
            ) : (
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">Pedido quitado.</span>
            )}
          </p>
          {receipt.observation && (
            <p className="text-[11px] text-stone-500 dark:text-stone-400 text-left whitespace-pre-wrap">{receipt.observation}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => generatePublicReceiptPDF(data as any)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ background: company.primary_color }}
        >
          <Download size={16} /> Baixar PDF do recibo
        </button>
      </div>
    </div>
  )
}
