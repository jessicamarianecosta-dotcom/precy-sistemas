'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Copy, Check, Download, AlertTriangle, Clock, CheckCircle2, Building2, ChevronDown, ChevronUp, Package } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { generatePublicChargePDF } from '@/lib/pdf/generatePublicChargePDF'
import { pixTypeLabel } from '@/lib/company/pix'

interface ApiResponse {
  charge: {
    amount_requested: number
    amount_due: number
    due_date: string
    notes: string | null
    status: 'pendente' | 'vencida' | 'paga' | 'cancelada'
    status_label: string
    created_at: string
  }
  order: { order_number: string; service_name: string | null; description: string | null; total: number }
  customer: { name: string | null }
  company: {
    name: string; email: string | null; phone: string | null; cnpj: string | null
    logo_url: string | null; primary_color: string; secondary_color: string
  }
  pix: { key: string; type: string; label: string; amount: number; payload: string; qrCodeBase64: string } | null
}

const STATUS_STYLE: Record<string, { icon: typeof Clock; className: string }> = {
  pendente:  { icon: Clock,        className: 'text-amber-600 dark:text-amber-400' },
  vencida:   { icon: AlertTriangle, className: 'text-red-600 dark:text-red-400' },
  paga:      { icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-400' },
  cancelada: { icon: AlertTriangle, className: 'text-stone-500' },
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch { /* clipboard indisponível — ignora */ }
      }}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copiado!' : label}
    </button>
  )
}

export default function CobrancaPublicaPage() {
  const params = useParams()
  const token = String(params.token ?? '')
  const [showOrderDetails, setShowOrderDetails] = useState(false)

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ['loja-cobranca', token],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`/api/loja/cobranca/${token}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Cobrança não encontrada')
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
        <p className="text-sm text-stone-600 dark:text-stone-300">{(error as Error)?.message || 'Cobrança não encontrada'}</p>
      </div>
    )
  }

  const { charge, order, customer, company, pix } = data
  const status = STATUS_STYLE[charge.status] ?? STATUS_STYLE.pendente
  const StatusIcon = status.icon

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
              {company.name.charAt(0).toUpperCase() || <Building2 size={18} />}
            </div>
          )}
          <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">{company.name}</p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 text-center text-[11px] font-semibold text-amber-800 dark:text-amber-300">
          Esta é uma cobrança — ainda não é um comprovante de pagamento.
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 shadow-sm text-center space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Valor a pagar</p>
          <p className="text-3xl font-bold" style={{ color: company.primary_color }}>
            {formatCurrency(charge.amount_due)}
          </p>
          <div className={`flex items-center justify-center gap-1.5 text-xs font-semibold ${status.className}`}>
            <StatusIcon size={14} /> {charge.status_label}
          </div>
          <div className="pt-2 grid grid-cols-2 gap-2 text-xs text-left border-t border-stone-100 dark:border-stone-800 mt-2">
            <div>
              <p className="text-stone-400">Cliente</p>
              <p className="font-medium text-stone-700 dark:text-stone-200">{customer.name || '—'}</p>
            </div>
            <div>
              <p className="text-stone-400">Vencimento</p>
              <p className="font-medium text-stone-700 dark:text-stone-200">
                {new Date(charge.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
          {charge.notes && (
            <p className="pt-2 text-xs text-stone-500 dark:text-stone-400 border-t border-stone-100 dark:border-stone-800 mt-2 text-left whitespace-pre-wrap">
              {charge.notes}
            </p>
          )}

          <button
            type="button"
            onClick={() => setShowOrderDetails(v => !v)}
            className="w-full flex items-center justify-between gap-2 pt-2 mt-2 border-t border-stone-100 dark:border-stone-800 text-xs font-semibold text-stone-500 dark:text-stone-400"
          >
            <span className="flex items-center gap-1.5"><Package size={13} /> Pedido {order.order_number}</span>
            {showOrderDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showOrderDetails && (
            <div className="pt-1 text-left text-xs text-stone-600 dark:text-stone-300 space-y-1">
              {order.service_name && <p><b>{order.service_name}</b></p>}
              {order.description && <p className="whitespace-pre-wrap text-stone-500 dark:text-stone-400">{order.description}</p>}
              {!order.service_name && !order.description && <p className="text-stone-400">Sem detalhes adicionais.</p>}
            </div>
          )}
        </div>

        {pix && charge.status !== 'paga' && charge.status !== 'cancelada' ? (
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-center">Pagamento via Pix</h3>
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pix.qrCodeBase64} alt="QR Code Pix" className="w-48 h-48 rounded-lg border border-stone-200 dark:border-stone-700" />
              <div className="text-xs text-stone-500 dark:text-stone-400 text-center space-y-0.5">
                {pix.label && <p>Beneficiário: <b className="text-stone-700 dark:text-stone-200">{pix.label}</b></p>}
                <p className="break-all">Chave {pixTypeLabel(pix.type) || 'Pix'}: <b className="text-stone-700 dark:text-stone-200">{pix.key}</b></p>
              </div>
            </div>
            <CopyButton value={pix.key} label="Copiar chave Pix" />
            <CopyButton value={pix.payload} label="Copiar código Pix copia e cola" />
          </div>
        ) : charge.status === 'paga' ? (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4 text-center text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Esta cobrança já foi quitada.
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => generatePublicChargePDF(data as any)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ background: company.primary_color }}
        >
          <Download size={16} /> Baixar PDF da cobrança
        </button>
      </div>
    </div>
  )
}
