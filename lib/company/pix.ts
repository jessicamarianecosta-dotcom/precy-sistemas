/**
 * Dados de PIX da empresa (Configurações → Dados de pagamento).
 * Usado tanto no formulário de Configurações quanto no snapshot gravado
 * em `budgets`/`orders` no momento da criação do documento.
 */

export type PixType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'

export const PIX_TYPE_OPTIONS: { value: PixType; label: string }[] = [
  { value: 'cpf',       label: 'CPF' },
  { value: 'cnpj',      label: 'CNPJ' },
  { value: 'email',     label: 'E-mail' },
  { value: 'telefone',  label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave aleatória' },
]

const PIX_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PIX_TYPE_OPTIONS.map(o => [o.value, o.label])
)

export function pixTypeLabel(type?: string | null): string {
  if (!type) return ''
  return PIX_TYPE_LABELS[type] ?? type
}

export interface PixSnapshot {
  pix_type?: string | null
  pix_key?: string | null
  pix_label?: string | null
}

/** Extrai só os 3 campos de PIX de um registro (company/budget/order), para copiar como snapshot. */
export function extractPixSnapshot(source: Record<string, unknown> | null | undefined): PixSnapshot {
  const s = (source ?? {}) as any
  const key = s.pix_key ? String(s.pix_key).trim() : ''
  if (!key) return { pix_type: null, pix_key: null, pix_label: null }
  return {
    pix_type:  s.pix_type ? String(s.pix_type) : null,
    pix_key:   key,
    pix_label: s.pix_label ? String(s.pix_label).trim() || null : null,
  }
}
