'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Plus, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePrecyflowCompany } from '@/hooks/usePrecyflowCompany'
import { formatCurrency } from '@/lib/utils/format'
import { PrecyflowHeader } from '@/components/precyflow/Header'
import { PrecyflowEmptyState } from '@/components/precyflow/EmptyState'
import { format } from 'date-fns'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho', sent: 'Enviado', viewed: 'Enviado', approved: 'Aprovado', rejected: 'Recusado', converted: 'Aprovado',
}
const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-error-light text-error-dark',
  sent: 'bg-info-light text-info-dark', viewed: 'bg-info-light text-info-dark',
  approved: 'bg-success-light text-success-dark', converted: 'bg-success-light text-success-dark',
  rejected: 'bg-error-light text-error-dark',
}

function useBudgets(companyId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['precyflow-orcamentos', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from('budgets')
        .select('id, budget_number, status, total, valid_until, created_at, customers(name)')
        .eq('company_id', companyId as string)
        .order('created_at', { ascending: false }) as any
      if (error) throw error
      return data ?? []
    },
  })
}

export default function PrecyflowOrcamentosPage() {
  const { companyId, companyName } = usePrecyflowCompany()
  const { data: budgets, isLoading } = useBudgets(companyId)

  return (
    <div>
      <PrecyflowHeader title="Orçamentos" subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex justify-end">
          <Link href="/precyflow/app/orcamentos/novo" className="pf-btn-primary flex items-center gap-2 px-4 py-2.5">
            <Plus size={16} /> Novo orçamento
          </Link>
        </div>

        {isLoading ? (
          <div className="pf-card h-64 animate-pulse" />
        ) : !budgets?.length ? (
          <div className="pf-card">
            <PrecyflowEmptyState
              icon={FileText}
              title="Nenhum orçamento ainda"
              subtitle="Crie orçamentos com fotos dos produtos, validade e condições de pagamento."
              action={<Link href="/precyflow/app/orcamentos/novo" className="pf-btn-primary px-4 py-2 inline-block">Novo orçamento</Link>}
            />
          </div>
        ) : (
          <div className="pf-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: 'var(--pf-border)', color: 'var(--pf-text-secondary)' }}>
                  <th className="px-4 py-3 font-medium">Orçamento</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Validade</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b: any) => (
                  <tr key={b.id} className="border-b last:border-0" style={{ borderColor: 'var(--pf-border)' }}>
                    <td className="px-4 py-3">
                      <Link href={`/precyflow/app/orcamentos/${b.id}`} className="font-medium hover:underline">{b.budget_number}</Link>
                    </td>
                    <td className="px-4 py-3">{b.customers?.name ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(Number(b.total))}</td>
                    <td className="px-4 py-3">{b.valid_until ? format(new Date(b.valid_until), 'dd/MM/yyyy') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CLASS[b.status] ?? ''}`}>
                        {STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
