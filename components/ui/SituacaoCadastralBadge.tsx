/** Selo visual da situação cadastral retornada pela consulta de CNPJ (BrasilAPI). Não bloqueia o cadastro. */
export function SituacaoCadastralBadge({ situacao }: { situacao: string | null | undefined }) {
  if (!situacao) return null

  const s = situacao.toUpperCase()
  const isAtiva = s.includes('ATIVA')
  const isBaixada = s.includes('BAIXADA') || s.includes('EXTINTA') || s.includes('INAPTA')
  const isSuspensa = s.includes('SUSPENSA')

  const emoji = isAtiva ? '🟢' : isBaixada ? '🔴' : isSuspensa ? '🟡' : '⚪'
  const colorClass = isAtiva
    ? 'text-success-dark bg-success-light dark:bg-success/10'
    : isBaixada
      ? 'text-error bg-error-light dark:bg-error/10'
      : isSuspensa
        ? 'text-warning-dark bg-warning-light dark:bg-warning/10'
        : 'text-text-muted bg-stone-100 dark:bg-white/5'

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${colorClass}`}>
      <span>{emoji}</span>
      {situacao}
    </span>
  )
}
