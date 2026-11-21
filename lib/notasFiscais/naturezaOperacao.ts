import { buscarNaturezasOperacao } from '@/lib/notasFiscais/blingClient'

/**
 * Resolve a descrição de natureza de operação digitada pela usuária para o
 * `id` já cadastrado na conta Bling conectada (GET /naturezas-operacoes) —
 * a API de NF-e exige `naturezaOperacao` como `{ id }`, nunca texto livre,
 * e não existe endpoint para criar uma nova via API (ver
 * lib/notasFiscais/fieldMapping.ts e README). Nunca inventa um id: sem
 * match, erro claro pedindo para cadastrar no Bling primeiro.
 *
 * Mesma lógica usada por app/api/notas-fiscais/pedido/[orderId]/criar
 * (mantida lá sem alteração, de propósito — ver instruções do projeto de
 * não tocar no fluxo de pedido). Esta cópia serve só a rota de nota
 * avulsa (app/api/notas-fiscais/avulsa), para nunca precisar modificar a
 * rota de pedido já validada.
 */
export async function resolveNaturezaOperacaoId(accessToken: string, descricao: string): Promise<number> {
  const response: any = await buscarNaturezasOperacao(accessToken, descricao)
  const candidates: any[] = response?.data ?? []
  const exact = candidates.find(n => String(n?.descricao ?? '').trim().toLowerCase() === descricao.trim().toLowerCase())
  const match = exact ?? candidates[0]
  if (!match?.id) {
    throw new Error(
      `Nenhuma natureza de operação chamada "${descricao}" foi encontrada na conta Bling conectada. ` +
      `Cadastre-a em Bling → Cadastros → Naturezas de Operação antes de criar a nota.`
    )
  }
  return Number(match.id)
}
