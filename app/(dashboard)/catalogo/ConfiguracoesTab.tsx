'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { useCompanyId } from '@/hooks/useCompanyId'
import { Loader2, Store } from 'lucide-react'
import { toSlug } from '@/lib/utils/slug'
import { StoreAddressCard } from '@/components/catalog/settings/StoreAddressCard'
import { BrandIdentityCard } from '@/components/catalog/settings/BrandIdentityCard'
import { StoreColorsCard } from '@/components/catalog/settings/StoreColorsCard'
import { StoreDescriptionCard } from '@/components/catalog/settings/StoreDescriptionCard'
import { SocialLinksCard } from '@/components/catalog/settings/SocialLinksCard'
import { ContactInfoCard } from '@/components/catalog/settings/ContactInfoCard'
import { SeoCard } from '@/components/catalog/settings/SeoCard'
import { StorePreviewCard } from '@/components/catalog/settings/StorePreviewCard'
import { HelpTipsCard } from '@/components/catalog/settings/HelpTipsCard'
import { DEFAULT_CATALOG_SETTINGS, type CatalogSettings } from './catalogSettingsTypes'

const SETTINGS_COLUMNS = `
  slug, logo_url, banner_url, description, whatsapp, instagram, facebook,
  tiktok, youtube, pinterest, website, address, phone, email, city, state,
  zip_code, business_hours, theme_color, checkout_mode, policies_text,
  seo_title, seo_description, seo_keywords, seo_image_url
`

export function ConfiguracoesTab() {
  const supabase = createClient()
  const { companyId } = useCompanyId()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [form, setFormState] = useState<CatalogSettings | null>(null)

  const { data, isLoading } = useQuery<CatalogSettings | null>({
    queryKey: ['catalog_settings', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('catalog_settings') as any)
        .select(SETTINGS_COLUMNS)
        .eq('company_id', companyId!)
        .maybeSingle()
      return data ?? DEFAULT_CATALOG_SETTINGS
    },
  })

  const current = form ?? data ?? null

  function setForm(patch: Partial<CatalogSettings>) {
    setFormState({ ...(current as CatalogSettings), ...patch })
  }

  const saveMutation = useMutation({
    mutationFn: async (settings: CatalogSettings) => {
      if (!settings.slug.trim()) throw new Error('Informe o endereço (slug) da loja')
      const { error } = await (supabase.from('catalog_settings') as any)
        .upsert([{ company_id: companyId, ...settings, slug: toSlug(settings.slug) }], { onConflict: 'company_id' })
      if (error) throw new Error(error.message.includes('duplicate') ? 'Esse endereço já está em uso por outra loja' : error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog_settings', companyId] })
      toast('success', 'Alterações salvas com sucesso.')
    },
    onError: (err: Error) => toast('error', err.message),
  })

  if (isLoading || !current) return <div className="py-8 text-center text-text-muted text-sm">Carregando…</div>

  return (
    <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(current) }} className="space-y-5 max-w-4xl">
      <StoreAddressCard value={current} onChange={setForm} companyId={companyId} />
      <BrandIdentityCard value={current} onChange={setForm} />
      <StoreColorsCard value={current} onChange={setForm} />
      <StoreDescriptionCard value={current} onChange={setForm} />
      <SocialLinksCard value={current} onChange={setForm} />
      <ContactInfoCard value={current} onChange={setForm} />
      <SeoCard value={current} onChange={setForm} />
      <StorePreviewCard value={current} onChange={setForm} />
      <HelpTipsCard />

      <div className="card p-4">
        <div className="flex gap-2">
          {(['buy', 'quote'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setForm({ checkout_mode: mode })}
              className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                current.checkout_mode === mode
                  ? 'bg-primary text-white border-primary'
                  : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400'
              }`}
            >
              {mode === 'buy' ? 'Comprar (checkout)' : 'Solicitar orçamento'}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <label className="text-xs text-text-muted mb-1 block">Políticas (trocas, entrega, etc.)</label>
          <textarea className="input" rows={3} value={current.policies_text ?? ''} onChange={e => setForm({ policies_text: e.target.value })} />
        </div>
      </div>

      <button type="submit" disabled={saveMutation.isPending} className="btn-primary text-base px-6 py-3 flex items-center gap-2 sticky bottom-4 shadow-lg">
        {saveMutation.isPending ? <Loader2 size={17} className="animate-spin" /> : <Store size={17} />}
        {saveMutation.isPending ? 'Salvando…' : 'Salvar configurações'}
      </button>
    </form>
  )
}
