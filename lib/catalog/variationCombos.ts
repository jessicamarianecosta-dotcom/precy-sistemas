export interface OptionRow {
  id: string; group_id: string; value: string; sort_order: number
  /** Acréscimo de preço desta opção sobre o preço-base da combinação (migration 088). */
  price_adjustment_type?: 'fixed' | 'percent' | null
  price_adjustment_value?: number | null
  /** Imagem padrão aplicada a combinações com esta opção sem imagem própria (migration 092). */
  default_image_id?: string | null
}
export interface GroupRow {
  id: string; name: string; sort_order: number; options: OptionRow[]
  /** false = grupo opcional — a pessoa pode deixar sem nenhuma opção selecionada (ex: um "Extra" opcional). Ausente/true = obrigatório (comportamento padrão, igual a sempre antes desta migration). */
  is_required?: boolean
}
export interface DependencyRow { id?: string; option_id: string; depends_on_option_id: string }

export function comboKey(optionIds: (string | null | undefined)[]) {
  // join() já trata null/undefined como string vazia — uma posição sem
  // opção (grupo opcional) fica igual a uma string vazia explícita, então
  // as duas formas de "sem seleção" neste arquivo sempre geram a mesma
  // chave, desde que a ORDEM dos grupos usada para montar o array seja
  // sempre a mesma (sort_order) nos dois lados da comparação.
  return optionIds.join('|')
}

/**
 * Identifica, por nome, se um grupo de variação é o grupo "Capa" — critério
 * dinâmico (qualquer produto que tenha cadastrado um grupo com esse nome
 * exato, não um produto ou coleção específica). Comparação exata (sem
 * acento, trim, case-insensitive) pra não confundir com grupos parecidos
 * como "Acabamento capa" ou "Capa dura", que devem continuar com a seleção
 * tradicional em pills.
 */
export function isCapaGroup(name: string): boolean {
  return name.trim().toLowerCase() === 'capa'
}

/**
 * Resolve a imagem padrão de uma combinação a partir das opções selecionadas
 * (uma por grupo, na mesma ordem de `groups`). Quando mais de um grupo
 * selecionado tem `default_image_id` configurado, o grupo que vem DEPOIS na
 * ordem da tela vence — permite um grupo mais específico (ex: "Modelo",
 * geralmente o último) sobrepor a imagem de um grupo mais genérico (ex:
 * "Capa"). Retorna null quando nenhuma opção selecionada tem imagem padrão.
 */
export function resolveDefaultImageId(groups: GroupRow[], optionIdByGroup: (string | null | undefined)[]): string | null {
  let result: string | null = null
  groups.forEach((g, idx) => {
    const opt = g.options.find(o => o.id === optionIdByGroup[idx])
    if (opt?.default_image_id) result = opt.default_image_id
  })
  return result
}

/**
 * Gera só as combinações válidas: uma opção sem nenhuma dependência é sempre
 * permitida; uma opção com 1+ dependências só é permitida quando pelo menos
 * uma das opções-pai (depends_on_option_id) já foi escolhida em algum grupo
 * anterior (semântica OU entre múltiplos pais). Substitui o antigo produto
 * cartesiano puro — sem regra cadastrada, o comportamento é idêntico ao
 * cartesiano de antes (100% compatível com produtos sem dependências).
 */
export function generateValidCombos(groups: GroupRow[], deps: DependencyRow[]): string[][] {
  const parentsByOption = new Map<string, Set<string>>()
  for (const d of deps) {
    if (!parentsByOption.has(d.option_id)) parentsByOption.set(d.option_id, new Set())
    parentsByOption.get(d.option_id)!.add(d.depends_on_option_id)
  }

  let combos: string[][] = [[]]
  for (const g of groups) {
    const next: string[][] = []
    for (const partial of combos) {
      const chosen = new Set(partial)
      for (const opt of g.options) {
        const parents = parentsByOption.get(opt.id)
        const allowed = !parents || parents.size === 0 || [...parents].some(p => chosen.has(p))
        if (allowed) next.push([...partial, opt.id])
      }
    }
    combos = next
  }
  return combos
}
