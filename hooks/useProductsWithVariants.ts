import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * ids dos produtos que têm ao menos uma combinação ativa (1 consulta por empresa).
 *
 * Expõe `isLoading` porque quem usa isto pra decidir se abre o seletor de
 * variação (em vez de adicionar o produto direto) precisa tratar "ainda
 * carregando" como "pode ter variação" — nunca como "não tem" (`data ?? new
 * Set()` cairia nesse caso de forma transparente e, numa corrida entre esta
 * consulta e o clique do usuário, deixaria passar um produto com variações
 * sem pedir a escolha).
 */
export function useProductsWithVariants(companyId: string | null | undefined) {
  const supabase = createClient()
  const { data, isLoading } = useQuery<Set<string>>({
    queryKey: ['products-with-variants', companyId],
    enabled: !!companyId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await (supabase.from('product_variants') as any)
        .select('product_id').eq('company_id', companyId!).eq('is_active', true)
      return new Set<string>((data ?? []).map((r: any) => r.product_id))
    },
  })
  return { data: data ?? new Set<string>(), isLoading: isLoading && !!companyId }
}
