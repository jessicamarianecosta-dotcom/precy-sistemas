import { formatCurrency } from '@/lib/utils/format'

/**
 * Emojis gerados a partir do código numérico Unicode (não como caracteres
 * literais no arquivo) — evita que qualquer etapa da cadeia de build/deploy
 * (editor, Git, bundler) corrompa esses caracteres especiais em trânsito.
 */
const EMOJI = {
  smile:   String.fromCodePoint(0x1f60a), // 😊
  heart:   String.fromCodePoint(0x1f495), // 💕
  pin:     String.fromCodePoint(0x1f4cd), // 📍
  scooter: String.fromCodePoint(0x1f6f5), // 🛵
  receipt: String.fromCodePoint(0x1f9fe), // 🧾
  warning: String.fromCodePoint(0x26a0, 0xfe0f), // ⚠️
}

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
  lines.push(`${EMOJI.smile} Olá, ${data.customerName}!`)
  lines.push('')
  lines.push(`Seu pedido #${data.orderNumber || '—'} já está pronto e disponível para retirada. ${EMOJI.heart}`)

  if (data.companyAddress) {
    lines.push('')
    lines.push(`${EMOJI.pin} Endereço para retirada:`)
    lines.push(data.companyAddress)
  }

  lines.push('')
  lines.push(`${EMOJI.scooter} A retirada pode ser feita pessoalmente ou você pode enviar um motoboy pelo aplicativo — nesse caso, envie o link de acompanhamento da corrida ou avise quando o entregador chegar no endereço.`)
  lines.push('')
  lines.push(`${EMOJI.receipt} Não esqueça de informar o número do pedido (#${data.orderNumber || '—'}) na hora da retirada.`)

  if (data.pendingAmount > 0) {
    lines.push('')
    lines.push(`${EMOJI.warning} Identificamos um valor pendente de ${formatCurrency(data.pendingAmount)}. Pedimos, por gentileza, que a pendência seja regularizada antes da retirada do pedido.`)
  }

  lines.push('')
  lines.push(`Aguardamos você! ${EMOJI.smile}`)

  return lines.join('\n')
}

export function buildWhatsappUrl(phoneDigits: string, message: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`
}
