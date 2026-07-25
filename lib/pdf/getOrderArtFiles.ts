import { createClient } from '@/lib/supabase/client'
import type { OrderFile } from '@/components/orders/types'

export async function getOrderArtFiles(orderId: string): Promise<OrderFile[]> {
  const supabase = createClient()
  const { data } = await (supabase.from('order_files') as any)
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  return (data ?? []) as OrderFile[]
}
