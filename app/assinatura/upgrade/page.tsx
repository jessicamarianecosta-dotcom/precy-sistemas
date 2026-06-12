'use client'
import { useState } from 'react'
import { Crown, CheckCircle, Loader2, ArrowLeft } from 'lucide-react'
import { useSearchParams, useRouter }              from 'next/navigation'
import { Suspense } from 'react'

const PRO_FEATURES = [
  'Produtos e pedidos ilimitados',
  'Agenda integrada com pedidos',
  'Controle financeiro completo',
  'Contas a pagar e receber',
  'Parcelamentos e recorrências',
  'Relatórios avançados',
  'Biblioteca de conteúdos e ebooks',
  'Suporte por e-mail e WhatsApp',
]

function UpgradeContent() {
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const router       = useRouter()
  const from         = searchParams.get('from') ?? '/dashboard'

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro' }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { alert('Erro ao iniciar upgrade.') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0F0B08 0%, #1C1410 100%)' }}>
      <div className="w-full max-w-sm">
        <button onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-400 mb-6 transition-colors">
          <ArrowLeft size={13} /> Voltar ao dashboard
        </button>

        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(145deg, #2C2018, #1C1714)', border: '1px solid rgba(139,108,79,0.4)' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #8B6C4F, #C4A47B)' }} />
          <div className="p-6">
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(139,108,79,0.2)' }}>
                <Crown size={24} style={{ color: '#C4A47B' }} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">
                Recurso exclusivo PRO
              </p>
              <h2 className="text-lg font-bold text-stone-100 mb-1">Assine o Precy+ Pro</h2>
              <p className="text-xs text-stone-500">
                {from !== '/dashboard' ? `Desbloqueie ${from.replace('/', '')} e muito mais` : 'Acesso completo à plataforma'}
              </p>
            </div>

            <div className="space-y-2 mb-5">
              {PRO_FEATURES.map(f => (
                <div key={f} className="flex items-center gap-2.5">
                  <CheckCircle size={13} style={{ color: '#5C8B4F' }} className="flex-shrink-0" />
                  <span className="text-xs text-stone-300">{f}</span>
                </div>
              ))}
            </div>

            <div className="flex items-baseline justify-center gap-1 mb-5">
              <span className="text-3xl font-bold text-white">R$47</span>
              <span className="text-sm text-stone-500">/mês</span>
              <span className="text-[10px] text-stone-600 ml-1">≈ R$ 1,56/dia</span>
            </div>

            <button onClick={handleUpgrade} disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)', boxShadow: '0 4px 20px rgba(139,108,79,0.4)' }}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Crown size={15} />}
              {loading ? 'Redirecionando...' : 'Assinar Pro agora'}
            </button>
            <p className="text-center text-xs text-stone-600 mt-3">
              Cancele quando quiser · Sem fidelidade
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F0B08]" />}>
      <UpgradeContent />
    </Suspense>
  )
}
