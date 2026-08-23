'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/hooks/useCompanyId'
import { Header } from '@/components/layout/Header'
import { DeclarationEditor, emptyParty, todayISO, type DeclarationInitial, type PartyState, type ItemState } from '@/components/declarations/DeclarationEditor'
import { Loader2 } from 'lucide-react'

function companyToSender(company: any): PartyState {
  return {
    name: company?.name ?? '',
    document: company?.cnpj ?? '',
    zipCode: company?.zip_code ?? '',
    street: company?.street ?? '',
    number: company?.number ?? '',
    complement: company?.complement ?? '',
    neighborhood: company?.neighborhood ?? '',
    city: company?.city ?? '',
    state: company?.state ?? '',
  }
}

function customerToParty(c: any): PartyState {
  return {
    name: c?.name ?? '',
    document: c?.cpf_cnpj ?? '',
    zipCode: c?.zip_code ?? '',
    street: c?.street ?? '',
    number: c?.number ?? '',
    complement: c?.complement ?? '',
    neighborhood: c?.neighborhood ?? '',
    city: c?.city ?? '',
    state: c?.state ?? '',
  }
}

interface Prefill {
  customerId: string | null
  orderId: string | null
  recipient: PartyState | null
  items: ItemState[]
  totalWeightKg: string
  declarationCity: string
  notes: string
}

function NovaDeclaracaoInner() {
  const supabase = createClient()
  const { companyId } = useCompanyId()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')
  const duplicateId = searchParams.get('duplicateId')
  const needsPrefill = !!orderId || !!duplicateId

  const companyQuery = useQuery({
    queryKey: ['company-for-declaration', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('companies') as any).select('*').eq('id', companyId!).maybeSingle()
      return data as any
    },
  })

  const prefillQuery = useQuery<Prefill | null>({
    queryKey: ['declaration-prefill', companyId, orderId, duplicateId],
    enabled: !!companyId && needsPrefill,
    queryFn: async () => {
      if (duplicateId) {
        const { data: d } = await (supabase.from('content_declarations') as any).select('*').eq('id', duplicateId).single()
        if (!d) return null
        const { data: items } = await (supabase.from('content_declaration_items') as any)
          .select('*').eq('declaration_id', duplicateId).order('sort_order')
        return {
          customerId: d.customer_id,
          orderId: d.order_id,
          recipient: {
            name: d.recipient_name ?? '', document: d.recipient_document ?? '', zipCode: d.recipient_zip_code ?? '',
            street: d.recipient_street ?? '', number: d.recipient_number ?? '', complement: d.recipient_complement ?? '',
            neighborhood: d.recipient_neighborhood ?? '', city: d.recipient_city ?? '', state: d.recipient_state ?? '',
          },
          items: (items ?? []).map((i: any) => ({
            localId: crypto.randomUUID(), productId: i.product_id, description: i.description,
            quantity: String(i.quantity), value: String(i.value), weightHint: null,
          })),
          totalWeightKg: d.total_weight_kg != null ? String(d.total_weight_kg) : '',
          declarationCity: d.declaration_city ?? '',
          notes: d.notes ?? '',
        }
      }
      if (orderId) {
        const { data: order } = await (supabase.from('orders') as any).select('*, customers(*)').eq('id', orderId).single()
        if (!order) return null
        const { data: items } = await (supabase.from('order_items') as any)
          .select('*, products(weight_kg)').eq('order_id', orderId)
        const totalW = (items ?? []).reduce((s: number, i: any) => s + (Number(i.products?.weight_kg) || 0) * (Number(i.quantity) || 0), 0)
        return {
          customerId: order.customer_id ?? null,
          orderId: order.id,
          recipient: order.customers ? customerToParty(order.customers) : null,
          items: (items ?? []).map((i: any) => ({
            localId: crypto.randomUUID(),
            productId: i.product_id,
            description: i.name || i.description || 'Item',
            quantity: String(i.quantity ?? 1),
            value: String(Number(i.subtotal) || (Number(i.unit_price) || 0) * (Number(i.quantity) || 1)),
            weightHint: i.products?.weight_kg != null ? Number(i.products.weight_kg) : null,
          })),
          totalWeightKg: totalW > 0 ? totalW.toFixed(3) : '',
          declarationCity: '',
          notes: '',
        }
      }
      return null
    },
  })

  const ready = !!companyId && companyQuery.isSuccess && (!needsPrefill || prefillQuery.isSuccess)

  if (!ready) {
    return (
      <div className="page-enter">
        <Header title="Nova Declaração de Conteúdo" />
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary" size={28} /></div>
      </div>
    )
  }

  const company = companyQuery.data
  const prefill = prefillQuery.data

  const initial: DeclarationInitial = {
    customerId: prefill?.customerId ?? null,
    orderId: prefill?.orderId ?? null,
    sender: companyToSender(company),
    recipient: prefill?.recipient ?? emptyParty(),
    items: prefill?.items ?? [],
    totalWeightKg: prefill?.totalWeightKg ?? '',
    declarationCity: prefill?.declarationCity || company?.city || '',
    declarationDate: todayISO(),
    notes: prefill?.notes ?? '',
  }

  return (
    <div className="page-enter">
      <Header title="Nova Declaração de Conteúdo" subtitle="Preencha os dados e a prévia atualiza automaticamente" />
      <div className="p-4 sm:p-6">
        <DeclarationEditor companyId={companyId!} initial={initial} />
      </div>
    </div>
  )
}

export default function NovaDeclaracaoPage() {
  return (
    <Suspense fallback={
      <div className="page-enter">
        <Header title="Nova Declaração de Conteúdo" />
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary" size={28} /></div>
      </div>
    }>
      <NovaDeclaracaoInner />
    </Suspense>
  )
}
