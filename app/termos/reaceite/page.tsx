'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, CheckCircle, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ReaceiteTermosPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAccept() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/legal/accept', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true }),
      })
      if (!res.ok) throw new Error('Erro ao registrar aceite')
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Erro ao registrar seu aceite. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0F0B08 0%, #1C1410 100%)' }}
    >
      <div className="w-full max-w-sm">
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
                <FileText size={24} style={{ color: '#C4A47B' }} />
              </div>
              <h2 className="text-lg font-bold text-stone-100 mb-1">Termos atualizados</h2>
              <p className="text-sm text-stone-400">
                O Precy+ atualizou seus Termos de Uso e Política de Privacidade.
              </p>
              <p className="text-xs text-stone-500 mt-2">
                Para continuar usando o sistema, é necessário ler e aceitar os documentos atualizados.
              </p>
            </div>

            <div className="space-y-2 mb-5">
              <a
                href="/termos" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-medium text-stone-300 border border-stone-700 hover:border-stone-500 transition-colors"
              >
                <FileText size={13} /> Ler Termos de Uso
              </a>
              <a
                href="/privacidade" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-medium text-stone-300 border border-stone-700 hover:border-stone-500 transition-colors"
              >
                <FileText size={13} /> Ler Política de Privacidade
              </a>
            </div>

            {error && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-900/20 border border-red-700/30">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              onClick={handleAccept}
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)', boxShadow: '0 4px 20px rgba(139,108,79,0.4)' }}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              {loading ? 'Registrando...' : 'Aceitar e continuar'}
            </button>

            <button
              onClick={handleLogout}
              className="w-full mt-3 py-2 rounded-xl text-xs text-stone-500 hover:text-stone-300 flex items-center justify-center gap-1.5 transition-colors"
            >
              <LogOut size={12} /> Sair sem aceitar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
