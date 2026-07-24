'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X, Cookie, Shield } from 'lucide-react'

const CONSENT_KEY = 'precy_cookie_consent'
const CONSENT_VERSION = '1.0'
const CONSENT_RESOLVED_EVENT = 'precy:cookie-consent-resolved'

export function CookieBanner() {
  const [show, setShow] = useState(false)
  const [detail, setDetail] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY)
      if (!stored) setShow(true)
      else {
        const parsed = JSON.parse(stored)
        if (parsed.version !== CONSENT_VERSION) setShow(true)
      }
    } catch { setShow(true) }
  }, [])

  function accept(all: boolean) {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({
        version: CONSENT_VERSION,
        essential: true,
        analytics: all,
        acceptedAt: new Date().toISOString(),
      }))
    } catch {}
    setShow(false)
    window.dispatchEvent(new Event(CONSENT_RESOLVED_EVENT))
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-3 sm:p-4">
      <div className="max-w-2xl mx-auto bg-[#1C1714] border border-stone-700/60 rounded-2xl shadow-[0_-4px_40px_rgba(0,0,0,0.5)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Cookie size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-stone-100 mb-1">Cookies e privacidade</p>
            <p className="text-xs text-stone-400 leading-relaxed">
              Usamos cookies essenciais para funcionamento e, com seu consentimento, cookies analíticos para melhorar a plataforma.{' '}
              <Link href="/privacidade" className="text-primary hover:underline">Saiba mais</Link>
            </p>
            {detail && (
              <div className="mt-3 space-y-2">
                {[
                  { label: 'Essenciais', desc: 'Autenticação e funcionamento básico — sempre ativos', required: true },
                  { label: 'Analíticos', desc: 'Dados de uso anonimizados para melhorar o sistema', required: false },
                ].map(c => (
                  <div key={c.label} className="flex items-center gap-3 py-2 border-t border-stone-800">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-stone-200">{c.label}</p>
                      <p className="text-[11px] text-stone-500 mt-0.5">{c.desc}</p>
                    </div>
                    <div className={`w-8 h-4 rounded-full flex items-center px-0.5 flex-shrink-0 ${c.required ? 'bg-primary' : 'bg-stone-700'}`}>
                      <div className={`w-3 h-3 rounded-full bg-white transition-transform ${c.required ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => accept(false)} className="p-1.5 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors flex-shrink-0 mt-0.5">
            <X size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <button onClick={() => setDetail(d => !d)}
            className="text-xs text-stone-500 hover:text-stone-300 transition-colors">
            {detail ? 'Ocultar detalhes' : 'Personalizar'}
          </button>
          <div className="flex-1" />
          <button onClick={() => accept(false)}
            className="px-4 py-2 text-xs font-medium text-stone-300 border border-stone-700 rounded-xl hover:border-stone-500 transition-colors">
            Apenas essenciais
          </button>
          <button onClick={() => accept(true)}
            className="px-4 py-2 text-xs font-bold text-white bg-primary rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5">
            <Shield size={12} /> Aceitar todos
          </button>
        </div>
      </div>
    </div>
  )
}
