'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/hooks/useCompanyId'
import { Header } from '@/components/layout/Header'
import { DeclarationEditor, type DeclarationInitial, type PartyState } from '@/components/declarations/DeclarationEditor'
import { EmptyState } from '@/components/ui/EmptyState'
import { FileX, Loader2 } from 'lucide-react'

function partyFromRow(d: any, prefix: 'sender' | 'recipient'): PartyState {
  return {
    name: d[`${prefix}_name`] ?? '',
    document: d[`${prefix}_document`] ?? '',
    zipCode: d[`${prefix}_zip_code`] ?? '',
    street: d[`${prefix}_street`] ?? '',
    number: d[`${prefix}_number`] ?? '',
    complement: d[`${prefix}_complement`] ?? '',
    neighborhood: d[`${prefix}_neighborhood`] ?? '',
    city: d[`${prefix}_city`] ?? '',
    state: d[`${prefix}_state`] ?? '',
  }
}

export default function EditarDeclaracaoPage() {
  const supabase = createClient()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { companyId } = useCompanyId()

  const { data, isLoading, isSuccess } = useQuery({
    queryKey: ['content-declaration', params.id],
    enabled: !!params.id,
    queryFn: async () => {
      const { data: d } = await (supabase.from('content_declarations') as any)
        .select('*').eq('id', params.id).maybeSingle()
      if (!d) return null
      const { data: items } = await (supabase.from('content_declaration_items') as any)
        .select('*').eq('declaration_id', params.id).order('sort_order')
      return { declaration: d, items: items ?? [] }
    },
  })

  if (isLoading || !companyId) {
    return (
      <div className="page-enter">
        <Header title="Declaração de Conteúdo" />
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary" size={28} /></div>
      </div>
    )
  }

  if (isSuccess && !data) {
    return (
      <div className="page-enter">
        <Header title="Declaração de Conteúdo" />
        <div className="p-6">
          <EmptyState
            icon={FileX}
            title="Declaração não encontrada"
            description="Ela pode ter sido excluída, ou pertence a outra conta."
            action={{ label: 'Voltar para o histórico', onClick: () => router.push('/declaracao-conteudo') }}
          />
        </div>
      </div>
    )
  }

  if (!data) return null

  const { declaration: d, items } = data

  const initial: DeclarationInitial = {
    customerId: d.customer_id,
    orderId: d.order_id,
    sender: partyFromRow(d, 'sender'),
    recipient: partyFromRow(d, 'recipient'),
    items: items.map((i: any) => ({
      localId: i.id,
      productId: i.product_id,
      description: i.description ?? '',
      quantity: String(i.quantity),
      value: String(i.value),
      weightHint: null,
    })),
    totalWeightKg: d.total_weight_kg != null ? String(d.total_weight_kg) : '',
    declarationCity: d.declaration_city ?? '',
    declarationDate: d.declaration_date ?? '',
    notes: d.notes ?? '',
  }

  return (
    <div className="page-enter">
      <Header title={`Declaração — ${d.recipient_name}`} subtitle="Edite os dados, salve ou gere a impressão/PDF" />
      <div className="p-4 sm:p-6">
        <DeclarationEditor companyId={companyId} declarationId={d.id} initial={initial} />
      </div>
    </div>
  )
}
