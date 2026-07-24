'use client'

import { useEffect, useState } from 'react'
import { X, Download, Share, Smartphone, Monitor } from 'lucide-react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

const DISMISS_KEY = 'precy_install_dismissed_at'
const DISMISS_DAYS = 14
const COOKIE_CONSENT_KEY = 'precy_cookie_consent'
const COOKIE_RESOLVED_EVENT = 'precy:cookie-consent-resolved'

function isSafariDesktop() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /^((?!chrome|android).)*safari/i.test(ua)
}

export function InstallAppBanner() {
  const { platform, isStandalone, canPromptInstall, promptInstall } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(true)
  const [cookieResolved, setCookieResolved] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY)
      if (!raw) {
        setDismissed(false)
      } else {
        const elapsedDays = (Date.now() - Number(raw)) / (1000 * 60 * 60 * 24)
        setDismissed(elapsedDays < DISMISS_DAYS)
      }
    } catch {
      setDismissed(false)
    }
  }, [])

  useEffect(() => {
    try {
      if (localStorage.getItem(COOKIE_CONSENT_KEY)) setCookieResolved(true)
    } catch {}
    function onResolved() { setCookieResolved(true) }
    window.addEventListener(COOKIE_RESOLVED_EVENT, onResolved)
    return () => window.removeEventListener(COOKIE_RESOLVED_EVENT, onResolved)
  }, [])

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    setDismissed(true)
  }

  async function handleInstall() {
    const outcome = await promptInstall()
    if (outcome !== 'unavailable') dismiss()
  }

  if (isStandalone || dismissed || !cookieResolved) return null

  const showSafariDesktopHint = platform === 'desktop' && !canPromptInstall && isSafariDesktop()
  const showIosHint = platform === 'ios' && !canPromptInstall
  const showInstallButton = canPromptInstall

  if (!showInstallButton && !showIosHint && !showSafariDesktopHint) return null

  const Icon = platform === 'desktop' ? Monitor : Smartphone

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998] p-3 sm:p-4">
      <div className="max-w-md mx-auto sm:mx-0 sm:ml-4 bg-[#1C1714] border border-stone-700/60 rounded-2xl shadow-[0_-4px_40px_rgba(0,0,0,0.5)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-stone-100 mb-1">
              Instale o Precy+ {platform === 'desktop' ? 'no computador' : 'no celular'}
            </p>

            {showInstallButton && (
              <p className="text-xs text-stone-400 leading-relaxed">
                Acesse mais rápido, direto da {platform === 'desktop' ? 'sua área de trabalho' : 'tela inicial'}, sem precisar abrir o navegador.
              </p>
            )}

            {showIosHint && (
              <p className="text-xs text-stone-400 leading-relaxed flex items-center gap-1 flex-wrap">
                Toque em <Share size={12} className="inline text-stone-300" /> <strong className="text-stone-200">Compartilhar</strong> e depois em <strong className="text-stone-200">&ldquo;Adicionar à Tela de Início&rdquo;</strong>.
              </p>
            )}

            {showSafariDesktopHint && (
              <p className="text-xs text-stone-400 leading-relaxed">
                No menu <strong className="text-stone-200">Arquivo</strong> do Safari, escolha <strong className="text-stone-200">&ldquo;Adicionar ao Dock&rdquo;</strong>.
              </p>
            )}
          </div>
          <button onClick={dismiss} className="p-1.5 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors flex-shrink-0 mt-0.5">
            <X size={14} />
          </button>
        </div>

        {showInstallButton && (
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <div className="flex-1" />
            <button onClick={dismiss}
              className="px-4 py-2 text-xs font-medium text-stone-300 border border-stone-700 rounded-xl hover:border-stone-500 transition-colors">
              Agora não
            </button>
            <button onClick={handleInstall}
              className="px-4 py-2 text-xs font-bold text-white bg-primary rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5">
              <Download size={12} /> Instalar app
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
