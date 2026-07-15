'use client'

import { useState } from 'react'
import { X, MessageCircle, Mail, Loader2 } from 'lucide-react'
import { DEFAULT_REQUEST_MESSAGE } from './types'

interface Props {
  customerName?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
  onClose: () => void
  onConfirm: (opts: { message: string; sentVia: ('whatsapp' | 'email')[] }) => Promise<void> | void
}

function buildWhatsappUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '')
  const withCountry = digits.length <= 11 ? `55${digits}` : digits
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`
}

function buildMailtoUrl(email: string, message: string): string {
  return `mailto:${email}?subject=${encodeURIComponent('Sobre a arte do seu pedido')}&body=${encodeURIComponent(message)}`
}

/**
 * Não existe nenhuma integração de envio (e-mail/WhatsApp) real no projeto.
 * Isso abre wa.me/mailto com a mensagem pronta — o envio final é manual
 * (a pessoa clica "Enviar" no WhatsApp Web ou no cliente de e-mail).
 */
export function RequestNewArtModal({ customerName, customerPhone, customerEmail, onClose, onConfirm }: Props) {
  const [message, setMessage] = useState(DEFAULT_REQUEST_MESSAGE)
  const [viaWhatsapp, setViaWhatsapp] = useState(!!customerPhone)
  const [viaEmail, setViaEmail] = useState(!customerPhone && !!customerEmail)
  const [sending, setSending] = useState(false)

  async function handleConfirm() {
    setSending(true)
    try {
      const sentVia: ('whatsapp' | 'email')[] = []
      if (viaWhatsapp && customerPhone) {
        window.open(buildWhatsappUrl(customerPhone, message), '_blank')
        sentVia.push('whatsapp')
      }
      if (viaEmail && customerEmail) {
        window.location.href = buildMailtoUrl(customerEmail, message)
        sentVia.push('email')
      }
      await onConfirm({ message, sentVia })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-md animate-scaleIn overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border dark:border-border-dark">
          <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Solicitar nova arte</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted">
            <X size={15} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
              Mensagem para {customerName || 'o cliente'}
            </label>
            <textarea
              rows={7}
              className="input resize-none"
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-text-primary dark:text-stone-200 mb-2">Enviar por:</p>
            <div className="space-y-2">
              <label className={`flex items-center gap-2.5 text-sm ${!customerPhone ? 'opacity-40' : ''}`}>
                <input type="checkbox" disabled={!customerPhone} checked={viaWhatsapp}
                  onChange={e => setViaWhatsapp(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                <MessageCircle size={15} className="text-success" /> WhatsApp
                {!customerPhone && <span className="text-xs text-text-muted">(sem telefone cadastrado)</span>}
              </label>
              <label className={`flex items-center gap-2.5 text-sm ${!customerEmail ? 'opacity-40' : ''}`}>
                <input type="checkbox" disabled={!customerEmail} checked={viaEmail}
                  onChange={e => setViaEmail(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                <Mail size={15} className="text-info" /> E-mail
                {!customerEmail && <span className="text-xs text-text-muted">(sem e-mail cadastrado)</span>}
              </label>
            </div>
          </div>

          <p className="text-[11px] text-text-muted dark:text-stone-500">
            Abre o WhatsApp Web e/ou seu aplicativo de e-mail com a mensagem pronta — o envio final é
            feito por você (não há integração automática de envio).
          </p>
        </div>

        <div className="flex gap-3 p-4 sm:p-5 border-t border-border dark:border-border-dark">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button
            type="button"
            disabled={sending || (!viaWhatsapp && !viaEmail)}
            onClick={handleConfirm}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sending && <Loader2 size={14} className="animate-spin" />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
