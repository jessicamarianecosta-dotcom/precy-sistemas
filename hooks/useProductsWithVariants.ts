import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/** ids dos produtos que têm ao menos uma combinação ativa (1 consulta por empresa). */
export function useProductsWithVariants(companyId: string | null | undefined) {
  const supabase = createClient()
  const { data } = useQuery<Set<string>>({
    queryKey: ['products-with-variants', companyId],
    enabled: !!companyId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await (supabase.from('product_variants') as any)
        .select('product_id').eq('company_id', companyId!).eq('is_active', true)
      return new Set<string>((data ?? []).map((r: any) => r.product_id))
    },
  })
  return data ?? new Set<string>()
}
