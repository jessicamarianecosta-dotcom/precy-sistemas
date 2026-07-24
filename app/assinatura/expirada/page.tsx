'use client'
import { useState } from 'react'
import { Clock, Loader2, LogOut, ArrowRight, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter }    from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { PLANS } from '@/lib/stripe/plans'

export default function TrialExpiradaPage() {
  const [loadingPlan, setLoadingPlan] = useState<'basic' | 'pro' | null>(null)
  const [errMsg,       setErrMsg]     = useState('')
  const supabase = createClient()
  const router   = useRouter()
  const queryClient = useQueryClient()

  async function handleAssinar(plan: 'basic' | 'pro') {
    setLoadingPlan(plan)
    setErrMsg('')
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setErrMsg(data.error ?? 'Erro ao iniciar pagamento. Tente novamente.')
    } catch { setErrMsg('Erro ao iniciar pagamento. Tente novamente.') }
    finally { setLoadingPlan(null) }
  }

  async function handleLogout() {
    queryClient.clear()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0F0B08 0%, #1C1410 100%)' }}>
      <div className="w-full max-w-md text-center space-y-6">

        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: 'rgba(139,108,79,0.12)', border: '1px solid rgba(139,108,79,0.25)' }}>
          <Clock size={36} style={{ color: '#C4A47B' }} />
        </div>

        {/* Text */}
        <div>
          <h1 className="text-2xl font-bold text-white mb-3">Seu período de teste terminou.</h1>
          <p className="text-stone-400 leading-relaxed text-sm">
            Seu teste gratuito expirou. Para continuar utilizando o Precy+, escolha um plano.
          </p>
        </div>

        {/* Highlight */}
        <div className="p-4 rounded-2xl text-left space-y-1.5"
          style={{ background: 'rgba(139,108,79,0.08)', border: '1px solid rgba(139,108,79,0.2)' }}>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Seus dados estão seguros</p>
          <p className="text-xs text-stone-500 leading-relaxed">
            Todos os seus pedidos, clientes, produtos e histórico permanecem salvos.
            Assine para recuperar o acesso completo.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button onClick={() => handleAssinar('pro')} disabled={loadingPlan !== null}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)', boxShadow: '0 4px 20px rgba(139,108,79,0.4)' }}>
            {loadingPlan === 'pro' ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            Assinar Plano Pro — {PLANS.pro.priceLabel}
          </button>

          <button onClick={() => handleAssinar('basic')} disabled={loadingPlan !== null}
            className="w-full py-3 rounded-xl text-sm font-medium text-stone-300 flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-white/5 transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            {loadingPlan === 'basic' ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            Assinar Plano Basic — {PLANS.basic.priceLabel}
          </button>

          {errMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-900/20 border border-red-700/30">
              <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-400">{errMsg}</p>
            </div>
          )}

          <button onClick={handleLogout}
            className="w-full py-2.5 text-xs text-stone-600 flex items-center justify-center gap-1.5 hover:text-stone-400 transition-colors">
            <LogOut size={13} /> Sair da conta
          </button>
        </div>

        <p className="text-xs text-stone-700">
          Precy+ Sistemas · <a href="mailto:suporte@precyplus.com.br" className="hover:text-stone-500">suporte@precyplus.com.br</a>
        </p>
      </div>
    </div>
  )
}
