'use client'
import { useState } from 'react'
import { X, Crown, CheckCircle, Loader2, ArrowRight } from 'lucide-react'
import { clsx } from 'clsx'

const PRO_FEATURES = [
  'Produtos e pedidos ilimitados',
  'Cadastro completo de clientes',
  'Agenda integrada com pedidos',
  'Controle financeiro completo',
  'Orçamentos profissionais em PDF',
  'Relatórios avançados',
  'Biblioteca de conteúdos premium',
  'Suporte por e-mail e WhatsApp',
]

interface Props {
  open:      boolean
  onClose:   () => void
  reason?:   string
}

export function UpgradeModal({ open, onClose, reason }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan: 'pro' }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error ?? 'Erro ao criar sessão')
    } catch (err) {
      console.error('[upgrade]', err)
      alert('Erro ao iniciar upgrade. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.5)] animate-scaleIn"
        style={{ background: 'linear-gradient(145deg, #2C2018, #1C1714)', border: '1px solid rgba(139,108,79,0.4)' }}
      >
        {/* Accent bar */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #8B6C4F, #C4A47B, #8B6C4F40)' }} />

        <div className="p-6">
          <button onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-stone-500 hover:text-stone-300 hover:bg-white/5 transition-colors">
            <X size={15} />
          </button>

          {/* Header */}
          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(139,108,79,0.2)' }}>
              <Crown size={24} style={{ color: '#C4A47B' }} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">
              Recurso Exclusivo
            </p>
            <h2 className="text-lg font-bold text-stone-100 mb-1">Assine o Precy+ Pro</h2>
            {reason && (
              <p className="text-sm text-stone-400">{reason}</p>
            )}
          </div>

          {/* Features */}
          <div className="space-y-2 mb-5">
            {PRO_FEATURES.map(f => (
              <div key={f} className="flex items-center gap-2.5">
                <CheckCircle size={13} style={{ color: '#5C8B4F' }} className="flex-shrink-0" />
                <span className="text-xs text-stone-300">{f}</span>
              </div>
            ))}
          </div>

          {/* Price */}
          <div className="flex items-baseline justify-center gap-1 mb-5">
            <span className="text-3xl font-bold text-white">R$37</span>
            <span className="text-sm text-stone-500">/mês</span>
            <span className="text-[10px] text-stone-600 ml-1">= R$ 1,23/dia</span>
          </div>

          {/* CTA */}
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)', boxShadow: '0 4px 20px rgba(139,108,79,0.4)' }}
          >
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Redirecionando...</>
              : <><Crown size={15} /> Assinar Pro agora <ArrowRight size={15} /></>
            }
          </button>
          <button onClick={onClose}
            className="w-full py-2 mt-2 text-xs text-stone-600 hover:text-stone-400 transition-colors">
            Continuar no Basic
          </button>
        </div>
      </div>
    </div>
  )
}
