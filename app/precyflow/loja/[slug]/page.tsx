import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/precyflow/supabase-server'
import { ThemeRoot } from '@/components/precyflow/ThemeRoot'
import { LojaClient } from '@/components/precyflow/loja/LojaClient'
import type { PrecyFlowProduct, PrecyFlowStore } from '@/lib/precyflow/types'

export const revalidate = 0

export default async function LojaPublicaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServerClient()

  const { data: store } = await supabase
    .from('precyflow_stores')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()

  if (!store) notFound()

  const { data: products } = await supabase
    .from('precyflow_products')
    .select('*')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .eq('show_in_storefront', true)
    .order('display_order')

  const typedStore = store as PrecyFlowStore

  return (
    <ThemeRoot theme={typedStore.theme} accent={typedStore.theme_color}>
      <LojaClient store={typedStore} products={(products ?? []) as PrecyFlowProduct[]} />
    </ThemeRoot>
  )
}
