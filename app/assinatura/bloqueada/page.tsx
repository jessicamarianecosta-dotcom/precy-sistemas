'use client'
import { useState } from 'react'
import { ShieldAlert, Loader2, LogOut, CreditCard, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter }    from 'next/navigation'

export default function BloqueadaPage() {
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [loadingPortal,   setLoadingPortal]   = useState(false)
  const supabase = createClient()
  const router   = useRouter()

  async function handleRenovar() {
    setLoadingCheckout(true)
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro' }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { alert('Erro ao iniciar pagamento.') }
    finally { setLoadingCheckout(false) }
  }

  async function handlePortal() {
    setLoadingPortal(true)
    try {
      const res  = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { alert('Erro ao abrir portal.') }
    finally { setLoadingPortal(false) }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0F0B08 0%, #1C1410 100%)' }}>
      <div className="w-full max-w-md text-center space-y-6">

        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <ShieldAlert size={36} className="text-red-400" />
        </div>

        {/* Text */}
        <div>
          <h1 className="text-2xl font-bold text-white mb-3">Assinatura Expirada</h1>
          <p className="text-stone-400 leading-relaxed text-sm">
            Sua assinatura do Precy+ expirou.<br />
            Renove seu plano para voltar a acessar o sistema e todos os seus dados.
          </p>
        </div>

        {/* Highlight */}
        <div className="p-4 rounded-2xl text-left space-y-1.5"
          style={{ background: 'rgba(139,108,79,0.08)', border: '1px solid rgba(139,108,79,0.2)' }}>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Seus dados estão seguros</p>
          <p className="text-xs text-stone-500 leading-relaxed">
            Todos os seus pedidos, clientes, produtos e histórico permanecem salvos.
            Renove para recuperar o acesso completo.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button onClick={handleRenovar} disabled={loadingCheckout}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)', boxShadow: '0 4px 20px rgba(139,108,79,0.4)' }}>
            {loadingCheckout ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Renovar assinatura
          </button>

          <button onClick={handlePortal} disabled={loadingPortal}
            className="w-full py-3 rounded-xl text-sm font-medium text-stone-300 flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-white/5 transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            {loadingPortal ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
            Atualizar forma de pagamento
          </button>

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
