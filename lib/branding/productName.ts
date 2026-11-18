/**
 * Nome do produto exibido ao usuário, de acordo com o plano da empresa.
 * Contas no plano `essencial` veem "Precy Essencial"; todas as outras
 * (basic, pro, ou quando o plano ainda não é conhecido) veem "Precy+".
 *
 * Mantido como função pura e sem dependências para poder ser usado tanto
 * em componentes client quanto em qualquer outro contexto, sem risco de
 * puxar código server-only.
 */
export function getProductDisplayName(plan: string | null | undefined): string {
  return plan === 'essencial' ? 'Precy Essencial' : 'Precy+'
}
