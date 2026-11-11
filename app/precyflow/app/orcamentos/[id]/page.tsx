'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, Link as LinkIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePrecyflowCompany } from '@/hooks/usePrecyflowCompany'
import { formatCurrency } from '@/lib/utils/format'
import { PrecyflowHeader } from '@/components/precyflow/Header'
import { generateBudgetPDF } from '@/lib/pdf/generateBudgetPDF'
import { format } from 'date-fns'

const STATUS_ORDER = ['draft', 'sent', 'approved', 'rejected'] as const
const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho', sent: 'Enviado', viewed: 'Enviado', approved: 'Aprovado', rejected: 'Recusado', converted: 'Aprovado',
}

function useBudget(budgetId: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['precyflow-orcamento', budgetId],
    queryFn: async () => {
      const [{ data: budget, error }, { data: items }] = await Promise.all([
        supabase.from('budgets')
          .select('*, customers(name, phone, email, cpf_cnpj, city, state, address)')
          .eq('id', budgetId).single() as any,
        supabase.from('budget_items')
          .select('*, products(name, description, image_url, width, height, measurement_unit, finishings, finishing_type, technical_notes)')
          .eq('budget_id', budgetId) as any,
      ])
      if (error) throw error
      return { budget, items: items ?? [] }
    },
  })
}

export default function PrecyflowOrcamentoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const budgetId = params.id as string
  const { companyId, companyName } = usePrecyflowCompany()
  const { data, isLoading } = useBudget(budgetId)
  const queryClient = useQueryClient()
  const supabase = createClient()

  async function changeStatus(status: string) {
    await (supabase.from('budgets') as any).update({ status }).eq('id', budgetId)
    queryClient.invalidateQueries({ queryKey: ['precyflow-orcamento', budgetId] })
  }

  async function handleDownloadPdf() {
    if (!data?.budget || !companyId) return
    const { data: company } = await supabase.from('companies').select('*').eq('id', companyId).single() as any
    await generateBudgetPDF({ budget: data.budget, items: data.items, company, brandName: 'PrecyFlow' })
  }

  function copyPublicLink() {
    if (!data?.budget?.public_token) return
    const url = `${window.location.origin}/loja/orcamento/${data.budget.public_token}`
    navigator.clipboard.writeText(url)
    alert('Link copiado!')
  }

  if (isLoading || !data?.budget) {
    return (
      <div>
        <PrecyflowHeader title="Orçamento" subtitle={companyName} />
        <div className="p-4 sm:p-6"><div className="pf-card h-64 animate-pulse" /></div>
      </div>
    )
  }

  const { budget, items } = data

  return (
    <div>
      <PrecyflowHeader title={budget.budget_number} subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-4 max-w-3xl">
        <button onClick={() => router.push('/precyflow/app/orcamentos')} className="flex items-center gap-1.5 text-sm hover:underline">
          <ArrowLeft size={14} /> Voltar para orçamentos
        </button>

        <div className="pf-card p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-semibold">{budget.customers?.name ?? 'Cliente'}</p>
              <p className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>
                {budget.customers?.phone ?? budget.customers?.email ?? ''}
              </p>
            </div>
            <select value={budget.status} onChange={e => changeStatus(e.target.value)} className="input w-40 text-sm">
              {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="text-sm" style={{ color: 'var(--pf-text-secondary)' }}>
            Criado em {format(new Date(budget.created_at), 'dd/MM/yyyy')}
            {budget.valid_until && ` · Válido até ${format(new Date(budget.valid_until), 'dd/MM/yyyy')}`}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={handleDownloadPdf} className="pf-btn-primary flex items-center gap-2 px-3 py-2 text-sm">
              <Download size={14} /> Baixar PDF
            </button>
            {budget.public_token && (
              <button onClick={copyPublicLink} className="pf-card flex items-center gap-2 px-3 py-2 text-sm font-medium">
                <LinkIcon size={14} /> Copiar link público
              </button>
            )}
          </div>
        </div>

        <div className="pf-card p-4">
          <p className="text-sm font-semibold mb-3">Itens</p>
          <div className="divide-y" style={{ borderColor: 'var(--pf-border)' }}>
            {items.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                <span>{item.name ?? item.products?.name ?? 'Item'} × {item.quantity}</span>
                <span className="font-medium">{formatCurrency(Number(item.subtotal))}</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-3 pt-3 space-y-1 text-sm" style={{ borderColor: 'var(--pf-border)' }}>
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(Number(budget.subtotal))}</span></div>
            {Number(budget.discount) > 0 && (
              <div className="flex justify-between"><span>Desconto</span><span>-{formatCurrency(Number(budget.discount))}</span></div>
            )}
            <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatCurrency(Number(budget.total))}</span></div>
          </div>
        </div>

        {budget.notes && (
          <div className="pf-card p-4">
            <p className="text-sm font-semibold mb-1">Observações e condições</p>
            <p className="text-sm whitespace-pre-line" style={{ color: 'var(--pf-text-secondary)' }}>{budget.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
