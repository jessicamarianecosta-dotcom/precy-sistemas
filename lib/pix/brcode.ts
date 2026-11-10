/**
 * Geração de payload Pix no padrão BR Code (EMV QR Code) do Banco Central,
 * para pagamento por chave estática com valor e identificador de transação.
 * Não depende de nenhum gateway — a chave usada é sempre a cadastrada pela
 * própria empresa (snapshot congelado no orçamento), nunca uma chave fixa.
 *
 * Referência: Manual de Padrões para Iniciação do Pix (BR Code), Bacen/BCB.
 */

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0')
  return `${id}${len}${value}`
}

/** Remove acentos, mantém só A-Z/0-9/espaço, maiúsculas, trunca no limite. */
function sanitizeAlphaField(value: string, maxLen: number, fallback: string): string {
  const normalized = (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim()
  const result = normalized || fallback
  return result.slice(0, maxLen)
}

/** Alfanumérico, máx 25 chars — exigência do campo 62/05 (Reference Label). */
export function sanitizeTxid(id: string): string {
  const cleaned = (id || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return (cleaned || '***').slice(0, 25)
}

/** CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), exigido ao final do payload. */
function crc16ccitt(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export interface PixPayloadInput {
  pixKey: string
  merchantName: string
  merchantCity: string
  /** Valor em reais (ex.: 250.00). Omitir gera um payload sem valor fixo. */
  amount?: number | null
  /** Identificador da transação (txid). Será sanitizado para o formato exigido. */
  txid: string
}

/**
 * Monta o payload Pix Copia-e-Cola (BR Code) completo, pronto para ser
 * renderizado como QR Code e para o cliente colar no app do banco.
 */
export function buildPixPayload(input: PixPayloadInput): string {
  const pixKey = (input.pixKey || '').trim()
  if (!pixKey) {
    throw new Error('Chave Pix vazia')
  }

  const merchantName = sanitizeAlphaField(input.merchantName, 25, 'RECEBEDOR')
  const merchantCity = sanitizeAlphaField(input.merchantCity, 15, 'BRASIL')
  const txid = sanitizeTxid(input.txid)

  const merchantAccountInfo =
    tlv('00', 'br.gov.bcb.pix') +
    tlv('01', pixKey)

  const additionalDataField = tlv('05', txid)

  let payload =
    tlv('00', '01') + // Payload Format Indicator
    tlv('01', '12') + // Point of Initiation Method: 12 = QR dinâmico/estático reutilizável (com valor variável por transação)
    tlv('26', merchantAccountInfo) +
    tlv('52', '0000') + // Merchant Category Code
    tlv('53', '986') + // Currency: BRL
    (input.amount && input.amount > 0 ? tlv('54', input.amount.toFixed(2)) : '') +
    tlv('58', 'BR') +
    tlv('59', merchantName) +
    tlv('60', merchantCity) +
    tlv('62', additionalDataField)

  // Campo 63 (CRC16) é calculado sobre o payload + "6304" (id+tamanho do próprio campo)
  payload += '6304'
  const crc = crc16ccitt(payload)
  return payload + crc
}
