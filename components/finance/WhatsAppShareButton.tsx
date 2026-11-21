'use client'

import { useState } from 'react'
import { MessageCircle, X, Copy, Check, Monitor } from 'lucide-react'
import { clsx } from 'clsx'
import {
  normalizePhoneToWhatsapp, openWhatsappConversation,
  isDesktopForWhatsapp, getDesktopWhatsappMode, setDesktopWhatsappMode,
  type DesktopWhatsappMode,
} from '@/lib/orders/whatsapp'

/**
 * Botão genérico "Enviar pelo WhatsApp" para avisos de cobrança e
 * recibos — usado no pedido, no cliente (cobrança agregada) e no
 * recebimento (recibo). Sempre deixa o número e a mensagem editáveis
 * antes de abrir a conversa (nunca envia nada automaticamente), e usa
 * o mesmo mecanismo de abertura (wa.me / WhatsApp Web / app) já usado
 * em WhatsAppNotifyButton — sem alegar que a mensagem foi enviada.
 */
export function WhatsAppShareButton({
  phone,
  message,
  label = 'Enviar pelo WhatsApp',
  className,
  variant = 'primary',
}: {
  phone: string | null | undefined
  message: string
  label?: string
  className?: string
  variant?: 'primary' | 'secondary'
}) {
  const [open, setOpen] = useState(false)
  const [phoneInput, setPhoneInput] = useState(phone ?? '')
  const [messageInput, setMessageInput] = useState(message)
  const [copied, setCopied] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [desktopMode, setDesktopModeState] = useState<DesktopWhatsappMode>('web')

  function handleOpenModal() {
    setPhoneInput(phone ?? '')
    setMessageInput(message)
    setIsDesktop(isDesktopForWhatsapp())
    setDesktopModeState(getDesktopWhatsappMode())
    setOpen(true)
  }

  function changeDesktopMode(mode: DesktopWhatsappMode) {
    setDesktopWhatsappMode(mode)
    setDesktopModeState(mode)
  }

  const phoneDigits = normalizePhoneToWhatsapp(phoneInput)

  function handleOpenWhatsapp() {
    if (!phoneDigits) return
    openWhatsappConversation(phoneDigits, messageInput)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpenModal}
        className={
          className ??
          clsx(
            'w-full flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-colors',
            variant === 'primary'
              ? 'bg-success text-white hover:opacity-90'
              : 'border border-border dark:border-border-dark text-text-secondary dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800',
          )
        }
      >
        <MessageCircle size={14} /> {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 flex items-center gap-2">
                <MessageCircle size={16} className="text-success" /> Enviar pelo WhatsApp
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <X size={14} />
              </button>
            </div>

            <label className="block mb-3">
              <span className="text-xs font-medium text-text-secondary dark:text-stone-400">Número do WhatsApp</span>
              <input
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value)}
                placeholder="(41) 99999-9999"
                className="mt-1 w-full rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-primary text-text-primary dark:text-stone-100"
              />
              {phoneInput.trim() === '' ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  Sem telefone cadastrado — informe um número para continuar.
                </p>
              ) : !phoneDigits ? (
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">
                  Número inválido — confira o DDD e o telefone.
                </p>
              ) : null}
            </label>

            <label className="block mb-3">
              <span className="text-xs font-medium text-text-secondary dark:text-stone-400">Mensagem</span>
              <textarea
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                rows={7}
                className="mt-1 w-full rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-white/5 px-3 py-2.5 text-xs outline-none focus:border-primary text-text-primary dark:text-stone-100 leading-relaxed"
              />
            </label>

            {isDesktop && (
              <div className="mb-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary dark:text-stone-300 mb-1.5">
                  <Monitor size={12} /> No computador, abrir por:
                </div>
                <div className="flex items-center gap-1 bg-primary-50 dark:bg-white/5 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => changeDesktopMode('web')}
                    className={clsx(
                      'flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors',
                      desktopMode === 'web' ? 'bg-white dark:bg-surface-dark text-primary shadow-sm' : 'text-text-muted',
                    )}
                  >
                    WhatsApp Web
                  </button>
                  <button
                    type="button"
                    onClick={() => changeDesktopMode('app')}
                    className={clsx(
                      'flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors',
                      desktopMode === 'app' ? 'bg-white dark:bg-surface-dark text-primary shadow-sm' : 'text-text-muted',
                    )}
                  >
                    App WhatsApp Business
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(messageInput)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  } catch {
                    /* clipboard indisponível — ignora */
                  }
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border border-border dark:border-border-dark text-text-secondary dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado!' : 'Copiar mensagem'}
              </button>
              <button
                type="button"
                onClick={handleOpenWhatsapp}
                disabled={!phoneDigits}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-success text-white hover:opacity-90 disabled:opacity-50"
              >
                <MessageCircle size={14} /> Abrir WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
