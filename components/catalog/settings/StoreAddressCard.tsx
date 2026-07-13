'use client'

import { useEffect, useState } from 'react'
import { Link2, Copy, ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { toSlug } from '@/lib/utils/slug'
import { useToast } from '@/components/ui/Toaster'
import type { SettingsCardProps } from '@/app/(dashboard)/catalogo/catalogSettingsTypes'

const STORE_BASE_URL = 'precyplus.com.br/loja/'

interface Props extends SettingsCardProps {
  companyId: string | null
}

export function StoreAddressCard({ value, onChange, companyId }: Props) {
  const supabase = createClient()
  const { toast } = useToast()
  const [rawInput, setRawInput] = useState(value.slug)
  const debouncedSlug = useDebouncedValue(toSlug(rawInput), 400)
  const [checking, setChecking] = useState(false)
  const [taken, setTaken] = useState(false)

  useEffect(() => { setRawInput(value.slug) }, [value.slug])

  useEffect(() => {
    onChange({ slug: debouncedSlug })
  }, [debouncedSlug]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!debouncedSlug || !companyId) { setTaken(false); return }
    let cancelled = false
    setChecking(true)
    ;(supabase.from('catalog_settings') as any)
      .select('company_id')
      .eq('slug', debouncedSlug)
      .neq('company_id', companyId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!cancelled) { setTaken(!!data); setChecking(false) }
      })
    return () => { cancelled = true }
  }, [debouncedSlug, companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fullUrl = `https://${STORE_BASE_URL}${debouncedSlug || '...'}`
  const hasInvalidChars = rawInput !== '' && toSlug(rawInput) !== rawInput.toLowerCase()

  function copyLink() {
    navigator.clipboard.writeText(fullUrl).then(() => toast('success', 'Link copiado!'))
  }

  return (
    <div className="card p-5 space-y-3">
      <div>
        <h3 className="text-base font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
          <Link2 size={17} className="text-primary" /> Endereço da Loja
        </h3>
        <p className="text-sm text-text-secondary dark:text-stone-400 mt-1">
          Escolha um endereço exclusivo para compartilhar sua loja.
        </p>
      </div>

      <div className="flex items-stretch rounded-xl border border-border dark:border-border-dark overflow-hidden focus-within:ring-2 focus-within:ring-primary/40 transition-shadow">
        <span className="px-3 flex items-center text-sm text-text-muted bg-surface dark:bg-white/5 whitespace-nowrap">
          {STORE_BASE_URL}
        </span>
        <input
          className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none min-w-0"
          placeholder="lumilife"
          value={rawInput}
          onChange={e => setRawInput(e.target.value)}
        />
        {checking && <Loader2 size={15} className="self-center mr-3 animate-spin text-text-muted" />}
      </div>

      <p className="text-[11px] text-text-muted dark:text-stone-500">
        Use apenas letras minúsculas, números e hífen.
      </p>

      {hasInvalidChars && (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <AlertCircle size={13} /> Alguns caracteres serão removidos automaticamente ({toSlug(rawInput)}).
        </p>
      )}

      {taken && !checking && (
        <p className="flex items-center gap-1.5 text-xs text-error dark:text-red-400">
          <AlertCircle size={13} /> Este endereço já está sendo utilizado.
        </p>
      )}

      {debouncedSlug && !taken && !checking && (
        <div className="rounded-xl bg-primary-50 dark:bg-primary/10 p-3 space-y-2">
          <p className="text-xs text-text-secondary dark:text-stone-400">
            Seu endereço ficará: <span className="font-semibold text-text-primary dark:text-stone-100">{fullUrl}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyLink} className="btn-secondary text-xs flex items-center gap-1.5">
              <Copy size={12} /> Copiar link
            </button>
            <a href={`/loja/${debouncedSlug}`} target="_blank" rel="noreferrer" className="btn-secondary text-xs flex items-center gap-1.5">
              <ExternalLink size={12} /> Visualizar loja
            </a>
            <span className="flex items-center gap-1 text-xs text-success-dark dark:text-green-400">
              <CheckCircle size={13} /> Disponível
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
