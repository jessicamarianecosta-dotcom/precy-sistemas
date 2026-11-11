'use client'

import { useEffect, useState } from 'react'
import { Check, Cat as CatIcon, Palette } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePrecyflowCompany } from '@/hooks/usePrecyflowCompany'
import { usePrecyflowTheme } from '@/providers/PrecyflowThemeProvider'
import { PRECYFLOW_COLORS, type PrecyflowColorId } from '@/lib/precyflow/theme'
import { PrecyflowHeader } from '@/components/precyflow/Header'

function useCompanyProfile(companyId: string | null) {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!companyId) return
    supabase.from('companies').select('name, email, phone').eq('id', companyId).single().then(({ data }: any) => {
      if (data) { setName(data.name ?? ''); setEmail(data.email ?? ''); setPhone(data.phone ?? '') }
      setLoaded(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  return { name, setName, email, setEmail, phone, setPhone, loaded }
}

export default function PrecyflowConfiguracoesPage() {
  const { companyId, companyName } = usePrecyflowCompany()
  const { name, setName, email, setEmail, phone, setPhone, loaded } = useCompanyProfile(companyId)
  const { theme, color, setTheme, setColor } = usePrecyflowTheme()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSaveProfile() {
    if (!companyId) return
    if (!name.trim()) { setError('Informe o nome da loja.'); return }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const { error: err } = await (supabase.from('companies') as any)
        .update({ name: name.trim(), email: email.trim() || null, phone: phone.trim() || null })
        .eq('id', companyId)
      if (err) throw err
      setSaved(true)
    } catch {
      setError('Não foi possível salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PrecyflowHeader title="Configurações" subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-4 max-w-2xl">
        <div className="pf-card p-4 space-y-3">
          <p className="text-sm font-semibold">Perfil da loja</p>
          {!loaded ? (
            <div className="h-24 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--pf-bg)' }} />
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5">Nome do negócio</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Laços da Nina" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">E-mail</label>
                  <input className="input" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Telefone</label>
                  <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 90000-0000" />
                </div>
              </div>
              {error && <div className="bg-error-light text-error-dark text-sm px-4 py-3 rounded-xl">{error}</div>}
              <button onClick={handleSaveProfile} disabled={saving} className="pf-btn-primary flex items-center justify-center gap-2 px-4 py-2.5">
                {saved && !saving && <Check size={16} />}
                {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar perfil'}
              </button>
            </>
          )}
        </div>

        <div className="pf-card p-4 space-y-3">
          <p className="text-sm font-semibold">Tema do PrecyFlow</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setTheme('cat')}
              className={`p-4 rounded-xl border text-left flex items-center gap-3 ${theme === 'cat' ? 'pf-btn-primary' : ''}`}
              style={theme !== 'cat' ? { borderColor: 'var(--pf-border)' } : undefined}
            >
              <CatIcon size={20} />
              <div>
                <p className="text-sm font-semibold">Cat</p>
                <p className="text-xs opacity-80">Mascote + rosa</p>
              </div>
            </button>
            <button
              onClick={() => setTheme('cores')}
              className={`p-4 rounded-xl border text-left flex items-center gap-3 ${theme === 'cores' ? 'pf-btn-primary' : ''}`}
              style={theme !== 'cores' ? { borderColor: 'var(--pf-border)' } : undefined}
            >
              <Palette size={20} />
              <div>
                <p className="text-sm font-semibold">Cores</p>
                <p className="text-xs opacity-80">Escolha a sua cor</p>
              </div>
            </button>
          </div>

          {theme === 'cores' && (
            <div className="flex flex-wrap gap-2 pt-1">
              {Object.values(PRECYFLOW_COLORS).map(c => (
                <button
                  key={c.id}
                  onClick={() => setColor(c.id as PrecyflowColorId)}
                  className="w-9 h-9 rounded-full border-2 flex items-center justify-center"
                  style={{ backgroundColor: c.primary, borderColor: color === c.id ? c.primaryHover : 'transparent' }}
                  title={c.label}
                >
                  {color === c.id && <Check size={14} color="white" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-center" style={{ color: 'var(--pf-text-muted)' }}>
          Para configurar nome, descrição e link da vitrine pública, acesse o módulo Vitrine Virtual.
        </p>
      </div>
    </div>
  )
}
