'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Store, ExternalLink, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePrecyflowCompany } from '@/hooks/usePrecyflowCompany'
import { PrecyflowHeader } from '@/components/precyflow/Header'
import { toSlug } from '@/lib/utils/slug'
import { formatCurrency } from '@/lib/utils/format'

interface CatalogSettings {
  company_id: string
  slug: string | null
  description: string | null
  whatsapp: string | null
  instagram: string | null
  checkout_mode: string
}

interface Product {
  id: string
  name: string
  final_price: number
  is_active: boolean
  is_published_catalog: boolean
}

function useVitrineData(companyId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['precyflow-vitrine', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const [{ data: settings }, { data: products }] = await Promise.all([
        supabase.from('catalog_settings')
          .select('company_id, slug, description, whatsapp, instagram, checkout_mode')
          .eq('company_id', companyId as string).maybeSingle() as any,
        supabase.from('products')
          .select('id, name, final_price, is_active, is_published_catalog')
          .eq('company_id', companyId as string).eq('is_active', true).order('name') as any,
      ])
      return { settings: settings as CatalogSettings | null, products: (products ?? []) as Product[] }
    },
  })
}

export default function PrecyflowVitrinePage() {
  const { companyId, companyName } = usePrecyflowCompany()
  const { data, isLoading } = useVitrineData(companyId)
  const queryClient = useQueryClient()
  const supabase = createClient()

  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [instagram, setInstagram] = useState('')
  const [checkoutMode, setCheckoutMode] = useState<'buy' | 'quote'>('buy')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data?.settings) {
      setSlug(data.settings.slug ?? '')
      setDescription(data.settings.description ?? '')
      setWhatsapp(data.settings.whatsapp ?? '')
      setInstagram(data.settings.instagram ?? '')
      setCheckoutMode((data.settings.checkout_mode as 'buy' | 'quote') ?? 'buy')
    } else if (data && !data.settings && companyName) {
      setSlug(toSlug(companyName))
    }
  }, [data, companyName])

  async function handleSave() {
    if (!companyId) return
    const finalSlug = toSlug(slug) || toSlug(companyName)
    if (!finalSlug) { setError('Informe um link válido para a vitrine.'); return }

    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const { error: err } = await (supabase.from('catalog_settings') as any).upsert({
        company_id: companyId,
        slug: finalSlug,
        description: description.trim() || null,
        whatsapp: whatsapp.trim() || null,
        instagram: instagram.trim() || null,
        checkout_mode: checkoutMode,
      }, { onConflict: 'company_id' })
      if (err) throw err
      setSlug(finalSlug)
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: ['precyflow-vitrine', companyId] })
    } catch (e: any) {
      setError(e?.message?.includes('duplicate') || e?.code === '23505'
        ? 'Esse link já está em uso. Escolha outro.'
        : 'Não foi possível salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function togglePublished(p: Product) {
    await (supabase.from('products') as any).update({ is_published_catalog: !p.is_published_catalog }).eq('id', p.id)
    queryClient.invalidateQueries({ queryKey: ['precyflow-vitrine', companyId] })
  }

  const publishedCount = (data?.products ?? []).filter(p => p.is_published_catalog).length
  const isPublished = !!data?.settings?.slug && publishedCount > 0

  return (
    <div>
      <PrecyflowHeader title="Vitrine Virtual" subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-4 max-w-2xl">
        {isLoading ? (
          <div className="pf-card h-64 animate-pulse" />
        ) : (
          <>
            <div className="pf-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center pf-bg-primary-soft flex-shrink-0">
                <Store size={18} className="pf-text-primary-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{isPublished ? 'Vitrine publicada' : 'Vitrine em rascunho'}</p>
                <p className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>
                  {isPublished ? `${publishedCount} produto(s) visível(is) na loja` : 'Salve um link e publique produtos para abrir sua loja.'}
                </p>
              </div>
              {data?.settings?.slug && (
                <Link href={`/loja/${data.settings.slug}`} target="_blank" className="pf-card flex items-center gap-1.5 px-3 py-2 text-sm font-medium flex-shrink-0">
                  <ExternalLink size={14} /> Ver loja
                </Link>
              )}
            </div>

            <div className="pf-card p-4 space-y-3">
              <p className="text-sm font-semibold">Identidade da loja</p>
              <div>
                <label className="block text-sm font-medium mb-1.5">Link público</label>
                <div className="flex items-center gap-1 text-sm">
                  <span style={{ color: 'var(--pf-text-muted)' }}>/loja/</span>
                  <input className="input flex-1" value={slug} onChange={e => setSlug(e.target.value)} placeholder="laços-da-nina" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Descrição da loja</label>
                <textarea className="input" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Conte um pouco sobre o seu negócio" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">WhatsApp</label>
                  <input className="input" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 90000-0000" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Instagram</label>
                  <input className="input" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@seunegocio" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Ao finalizar a compra</label>
                <select className="input" value={checkoutMode} onChange={e => setCheckoutMode(e.target.value as 'buy' | 'quote')}>
                  <option value="buy">Cliente conclui o pedido direto na loja</option>
                  <option value="quote">Cliente só solicita orçamento</option>
                </select>
              </div>
              {error && <div className="bg-error-light text-error-dark text-sm px-4 py-3 rounded-xl">{error}</div>}
              <button onClick={handleSave} disabled={saving} className="pf-btn-primary w-full py-2.5 flex items-center justify-center gap-2">
                {saved && !saving ? <Check size={16} /> : null}
                {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar vitrine'}
              </button>
            </div>

            <div className="pf-card p-4">
              <p className="text-sm font-semibold mb-1">Produtos visíveis na loja</p>
              <p className="text-xs mb-3" style={{ color: 'var(--pf-text-secondary)' }}>
                Marque os produtos ativos que devem aparecer para os clientes.
              </p>
              {!data?.products?.length ? (
                <p className="text-sm py-4 text-center" style={{ color: 'var(--pf-text-muted)' }}>
                  Cadastre produtos ativos no módulo Produtos primeiro.
                </p>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--pf-border)' }}>
                  {data.products.map(p => (
                    <label key={p.id} className="flex items-center justify-between py-2.5 text-sm cursor-pointer">
                      <span className="flex items-center gap-2.5">
                        <input type="checkbox" checked={p.is_published_catalog} onChange={() => togglePublished(p)} className="w-4 h-4 rounded" />
                        {p.name}
                      </span>
                      <span className="font-medium">{formatCurrency(Number(p.final_price))}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
