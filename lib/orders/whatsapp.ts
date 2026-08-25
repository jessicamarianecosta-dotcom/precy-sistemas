import { formatCurrency } from '@/lib/utils/format'

/**
 * Normaliza um telefone brasileiro (qualquer formatação) para o padrão
 * exigido pelo link wa.me: DDI 55 + DDD + número, apenas dígitos.
 * Não altera o valor salvo no cadastro do cliente — uso só para o link.
 */
export function normalizePhoneToWhatsapp(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null
  const digits = rawPhone.replace(/\D/g, '')
  if (!digits) return null

  // Já vem com DDI 55 (ex: 5541999999999 ou 554199999999)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits
  }

  // DDD + número (10 dígitos = fixo, 11 dígitos = celular com 9)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  return null
}

export interface WhatsappOrderNotifyData {
  customerName: string
  orderNumber: string | null
  companyAddress?: string | null
  pendingAmount: number
}

/**
 * Monta a mensagem de "pedido pronto" — inclui o aviso de valor pendente
 * somente quando houver saldo em aberto real (não assume pendência total
 * por causa de pagamento parcial).
 */
export function buildOrderReadyMessage(data: WhatsappOrderNotifyData): string {
  const lines: string[] = []
  lines.push(`😊 Olá, ${data.customerName}!`)
  lines.push('')
  lines.push(`Seu pedido #${data.orderNumber || '—'} já está pronto e disponível para retirada. 💕`)

  if (data.companyAddress) {
    lines.push('')
    lines.push('📍 Endereço para retirada:')
    lines.push(data.companyAddress)
  }

  if (data.pendingAmount > 0) {
    lines.push('')
    lines.push(`⚠️ Identificamos um valor pendente de ${formatCurrency(data.pendingAmount)}. Pedimos, por gentileza, que a pendência seja regularizada antes da retirada do pedido.`)
  }

  lines.push('')
  lines.push('Aguardamos você! 😊')

  return lines.join('\n')
}

export function buildWhatsappUrl(phoneDigits: string, message: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`
}
