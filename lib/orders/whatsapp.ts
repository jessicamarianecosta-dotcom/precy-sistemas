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

/**
 * No celular, o wa.me faz o deep-link direto pro app e preserva os emojis
 * sem problema. No computador, o mesmo wa.me passa por um redirecionamento
 * (wa.me → api.whatsapp.com/send) que, nos testes, chegou corrompendo
 * especificamente os emojis (texto acentuado e demais símbolos chegam
 * intactos). Por isso, no desktop usamos o endereço direto do WhatsApp Web,
 * pulando esse redirecionamento problemático.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

/** URL da conversa no WhatsApp Web — mantém tudo dentro do navegador
 *  (mesma janela do Chrome, mesma sessão já autenticada). Nunca redireciona
 *  para wa.me / api.whatsapp.com, que exibem a tela intermediária e podem
 *  disparar o app nativo (WhatsApp pessoal) via `whatsapp://`. */
export function buildWhatsappWebUrl(phoneDigits: string, message: string): string {
  return `https://web.whatsapp.com/send?phone=${phoneDigits}&text=${encodeURIComponent(message)}`
}

/* ────────────────────────────────────────────────────────────────
   Preferência de como abrir o WhatsApp NO COMPUTADOR
   ────────────────────────────────────────────────────────────────
   O `web.whatsapp.com` mostra sempre a conta vinculada NAQUELE perfil
   do navegador. Se esse perfil está no WhatsApp pessoal, "Avisar
   cliente" abre a conversa no número pessoal — não há como uma página
   web escolher outra conta.

   Para quem usa o WhatsApp Business em um APP no computador (ou num
   perfil separado do Chrome onde o Business é a conta do sistema),
   existe a opção "app": usa o esquema `whatsapp://`, que o Windows/
   macOS entregam ao aplicativo padrão de WhatsApp.

   Guardado só no navegador (localStorage) — sem banco, por dispositivo.
*/
export type DesktopWhatsappMode = 'web' | 'app'
const DESKTOP_WA_MODE_KEY = 'precy:whatsapp-desktop-mode'

export function getDesktopWhatsappMode(): DesktopWhatsappMode {
  if (typeof window === 'undefined') return 'web'
  try {
    return window.localStorage.getItem(DESKTOP_WA_MODE_KEY) === 'app' ? 'app' : 'web'
  } catch {
    return 'web'
  }
}

export function setDesktopWhatsappMode(mode: DesktopWhatsappMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DESKTOP_WA_MODE_KEY, mode)
  } catch {
    /* localStorage indisponível — ignora */
  }
}

export function buildWhatsappUrl(phoneDigits: string, message: string): string {
  const encodedMessage = encodeURIComponent(message)
  if (isMobileDevice()) {
    return `https://wa.me/${phoneDigits}?text=${encodedMessage}`
  }
  return buildWhatsappWebUrl(phoneDigits, message)
}

function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

/**
 * Só considera "iOS de verdade" iPhone/iPod, ou um iPad — inclusive o iPadOS
 * 13+ que se apresenta como "Macintosh". A distinção do iPad-disfarçado-de-Mac
 * é feita por `navigator.maxTouchPoints > 1`: iPad tem 5, Mac de mesa tem 0.
 *
 * O check antigo (`'ontouchend' in document`) dava falso-positivo em
 * Chrome/Safari no macOS de mesa, jogando o usuário de computador no
 * deep link `whatsapp://` — que abre o app nativo (WhatsApp pessoal).
 */
function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPhone|iPod/i.test(ua)) return true
  const maxTouch = typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0
  if (/iPad/i.test(ua)) return true
  return /Macintosh/i.test(ua) && maxTouch > 1
}

/** true em computador (não é Android nem iPhone/iPad). Usado só pela UI
 *  para decidir se mostra a opção "WhatsApp Web × app WhatsApp Business". */
export function isDesktopForWhatsapp(): boolean {
  return !isAndroidDevice() && !isIOSDevice()
}

/**
 * Abre a conversa do WhatsApp com a mensagem já preenchida, escolhendo a
 * melhor estratégia por plataforma. Nunca envia nada — o usuário ainda
 * precisa tocar em "Enviar" dentro do app.
 *
 * Android: usa um Intent URL apontando para o pacote do WhatsApp Business
 * (com.whatsapp.w4b). Se o Business não estiver instalado, o próprio Android
 * usa o `browser_fallback_url` (wa.me), que então abre o WhatsApp normal ou,
 * na ausência dele, a versão web. Estratégia progressiva sem depender só do
 * user-agent para decidir qual app existe.
 *
 * iOS: tenta o esquema `whatsapp://` e cai para o link https (wa.me) caso o
 * app não responda.
 *
 * Desktop (Windows / macOS / Linux — inclusive Mac de mesa): por padrão
 * abre o WhatsApp Web numa nova aba do mesmo navegador, usando a sessão já
 * autenticada. Nunca usa wa.me / api.whatsapp.com (que exibem a tela
 * intermediária e podem disparar o app). O esquema `whatsapp://` só é usado
 * no desktop quando o usuário escolhe explicitamente o modo "app"
 * (getDesktopWhatsappMode() === 'app'), para quem roda o WhatsApp Business
 * como aplicativo no computador.
 */
export function openWhatsappConversation(phoneDigits: string, message: string): void {
  if (typeof window === 'undefined') return
  if (!phoneDigits) return

  const encodedMessage = encodeURIComponent(message)
  const httpsUrl = `https://wa.me/${phoneDigits}?text=${encodedMessage}`

  if (isAndroidDevice()) {
    const fallback = encodeURIComponent(httpsUrl)
    const intentUrl =
      `intent://send?phone=${phoneDigits}&text=${encodedMessage}` +
      `#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=${fallback};end`
    // Intent URLs precisam de navegação top-level; window.open abriria "about:blank".
    window.location.href = intentUrl
    return
  }

  if (isIOSDevice()) {
    const appUrl = `whatsapp://send?phone=${phoneDigits}&text=${encodedMessage}`
    let switched = false
    const onHide = () => { switched = true }
    document.addEventListener('visibilitychange', onHide, { once: true })
    window.location.href = appUrl
    window.setTimeout(() => {
      document.removeEventListener('visibilitychange', onHide)
      if (!switched && !document.hidden) window.location.href = httpsUrl
    }, 1200)
    return
  }

  // Desktop.
  const webUrl = buildWhatsappWebUrl(phoneDigits, message)

  // Modo "app": para quem usa o WhatsApp Business em aplicativo no
  // computador. Entrega o esquema whatsapp:// ao app padrão do sistema e,
  // se nada abrir em ~1,2s, cai para o WhatsApp Web em nova aba.
  if (getDesktopWhatsappMode() === 'app') {
    const appUrl = `whatsapp://send?phone=${phoneDigits}&text=${encodedMessage}`
    let switched = false
    const onHide = () => { switched = true }
    document.addEventListener('visibilitychange', onHide, { once: true })
    window.location.href = appUrl
    window.setTimeout(() => {
      document.removeEventListener('visibilitychange', onHide)
      if (!switched && !document.hidden) {
        const w = window.open(webUrl, '_blank')
        if (w) w.opener = null
      }
    }, 1200)
    return
  }

  // Modo "web" (padrão) — WhatsApp Web em nova aba, na sessão já conectada.
  const win = window.open(webUrl, '_blank')
  if (win) {
    // Evita que a aba do WhatsApp tenha referência de volta à janela do Precy+.
    win.opener = null
  } else {
    // Pop-up bloqueado: navega a própria aba como último recurso (o usuário
    // volta ao Precy+ pelo histórico). Ainda assim, é WhatsApp Web — não o app.
    window.location.href = webUrl
  }
}
