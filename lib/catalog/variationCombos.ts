export interface OptionRow { id: string; group_id: string; value: string; sort_order: number }
export interface GroupRow { id: string; name: string; sort_order: number; options: OptionRow[] }
export interface DependencyRow { id?: string; option_id: string; depends_on_option_id: string }

export function comboKey(optionIds: string[]) {
  return optionIds.join('|')
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
