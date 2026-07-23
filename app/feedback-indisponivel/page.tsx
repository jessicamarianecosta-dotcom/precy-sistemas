'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, MessageSquare, Lightbulb, Bug, Heart, Rocket } from 'lucide-react'

const FEEDBACK_TYPES = [
  { icon: Lightbulb, label: 'Sugestões' },
  { icon: Bug,       label: 'Relato de bugs' },
  { icon: Heart,     label: 'Elogios' },
  { icon: Rocket,    label: 'Novas funcionalidades' },
]

export default function FeedbackIndisponivelPage() {
  const router = useRouter()

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0F0B08 0%, #1C1410 100%)' }}
    >
      <div className="w-full max-w-sm">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-400 mb-6 transition-colors"
        >
          <ArrowLeft size={13} /> Voltar ao Dashboard
        </button>

        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(145deg, #2C2018, #1C1714)', border: '1px solid rgba(139,108,79,0.4)' }}
        >
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #8B6C4F, #C4A47B)' }} />
          <div className="p-6">
            <div className="text-center mb-5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(139,108,79,0.2)' }}
              >
                <MessageSquare size={24} style={{ color: '#C4A47B' }} />
              </div>
              <h2 className="text-lg font-bold text-stone-100 mb-1">Feedback</h2>
              <p className="text-sm font-medium text-stone-300 mb-1">
                Disponível após a assinatura de um plano pago.
              </p>
              <p className="text-xs text-stone-500">
                Durante o período de teste grátis este módulo fica reservado para assinantes Basic e PRO.
              </p>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2.5">
              Assinando, você poderá enviar:
            </p>
            <div className="space-y-2 mb-2">
              {FEEDBACK_TYPES.map(f => (
                <div key={f.label} className="flex items-center gap-2.5">
                  <f.icon size={13} style={{ color: '#C4A47B' }} className="flex-shrink-0" />
                  <span className="text-xs text-stone-300">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push('/assinatura/upgrade')}
          className="w-full mt-5 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)', boxShadow: '0 4px 20px rgba(139,108,79,0.4)' }}
        >
          Ver planos
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full mt-2.5 py-3 rounded-xl text-sm font-medium text-stone-400 hover:text-stone-200 transition-colors"
        >
          Voltar ao Dashboard
        </button>
      </div>
    </div>
  )
}
