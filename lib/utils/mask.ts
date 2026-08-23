/**
 * Máscaras de CNPJ/CPF e CEP do Precy+.
 * Regra: o banco e as APIs externas sempre recebem só dígitos — a máscara é
 * puramente visual, aplicada no input.
 */

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

export function formatCnpj(value: string | null | undefined): string {
  const d = onlyDigits(value).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function formatCpf(value: string | null | undefined): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Formata CPF (11 dígitos) ou CNPJ (14 dígitos) automaticamente conforme o tamanho digitado. */
export function formatCpfCnpj(value: string | null | undefined): string {
  const d = onlyDigits(value)
  return d.length > 11 ? formatCnpj(d) : formatCpf(d)
}

export function formatCep(value: string | null | undefined): string {
  const d = onlyDigits(value).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export function isValidCnpjLength(value: string | null | undefined): boolean {
  return onlyDigits(value).length === 14
}

export function isValidCepLength(value: string | null | undefined): boolean {
  return onlyDigits(value).length === 8
}
