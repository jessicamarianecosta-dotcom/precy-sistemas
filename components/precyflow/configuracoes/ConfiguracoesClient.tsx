'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, LogOut, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/precyflow/supabase'
import { Mascot } from '@/components/precyflow/Mascot'
import type { PrecyFlowAccent, PrecyFlowStore, PrecyFlowTheme } from '@/lib/precyflow/types'

const ACCENTS: { value: PrecyFlowAccent; label: string; swatch: string }[] = [
  { value: 'rosa', label: 'Rosa', swatch: '#D6447D' },
  { value: 'azul', label: 'Azul-claro', swatch: '#2F9FC4' },
  { value: 'lilas', label: 'Lilás', swatch: '#8B6FD0' },
  { value: 'preto', label: 'Preto/Branco', swatch: '#1F1B1D' },
  { value: 'verde', label: 'Verde', swatch: '#4F8B6C' },
  { value: 'marrom', label: 'Marrom', swatch: '#8B6C4F' },
]

export function ConfiguracoesClient({ store, userEmail }: { store: PrecyFlowStore; userEmail: string }) {
  const router = useRouter()
  const [theme, setTheme] = useState<PrecyFlowTheme>(store.theme)
  const [accent, setAccent] = useState<PrecyFlowAccent>(store.theme_color)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function saveTheme(nextTheme: PrecyFlowTheme, nextAccent: PrecyFlowAccent) {
    setSaving(true)
    setSaved(false)
    const supabase = createClient()
    await supabase.from('precyflow_stores').update({ theme: nextTheme, theme_color: nextAccent }).eq('id', store.id)
    setSaving(false)
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/precyflow/login')
    router.refresh()
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--pf-text)' }}>Configurações</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--pf-text-secondary)' }}>Preferências da sua conta</p>

      <div className="pf-card mb-6">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--pf-text)' }}>Tema</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => { setTheme('cat'); saveTheme('cat', accent) }}
            className="pf-card !p-3 text-left"
            style={{ borderColor: theme === 'cat' ? 'var(--pf-primary)' : 'var(--pf-border)', borderWidth: theme === 'cat' ? 2 : 1 }}
          >
            <Mascot size={28} />
            <div className="mt-1 text-sm font-medium" style={{ color: 'var(--pf-text)' }}>Cat</div>
            <div className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>Mascote + rosa</div>
          </button>
          <button
            onClick={() => { setTheme('cores'); saveTheme('cores', accent) }}
            className="pf-card !p-3 text-left"
            style={{ borderColor: theme === 'cores' ? 'var(--pf-primary)' : 'var(--pf-border)', borderWidth: theme === 'cores' ? 2 : 1 }}
          >
            <div className="flex gap-1">
              {ACCENTS.slice(0, 4).map(a => <span key={a.value} className="w-3 h-3 rounded-full" style={{ backgroundColor: a.swatch }} />)}
            </div>
            <div className="mt-1 text-sm font-medium" style={{ color: 'var(--pf-text)' }}>Cores</div>
            <div className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>Sem mascote</div>
          </button>
        </div>

        {theme === 'cores' && (
          <div className="flex flex-wrap gap-3">
            {ACCENTS.map(a => (
              <button
                key={a.value}
                onClick={() => { setAccent(a.value); saveTheme('cores', a.value) }}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: a.swatch, outline: accent === a.value ? '2px solid var(--pf-text)' : 'none', outlineOffset: 2 }}
                aria-label={a.label}
                title={a.label}
              >
                {accent === a.value && <Check size={16} color="#fff" />}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 text-xs flex items-center gap-2" style={{ color: 'var(--pf-text-secondary)' }}>
          {saving && <><Loader2 size={12} className="animate-spin" /> Salvando...</>}
          {saved && 'Tema atualizado!'}
        </div>
      </div>

      <div className="pf-card">
        <h2 className="font-semibold mb-2" style={{ color: 'var(--pf-text)' }}>Conta</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--pf-text-secondary)' }}>{userEmail}</p>
        <button onClick={handleLogout} className="pf-btn-secondary">
          <LogOut size={16} /> Sair da conta
        </button>
      </div>
    </div>
  )
}
