'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Store, ExternalLink, Copy, Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/precyflow/supabase-client'
import { formatBRL } from '@/lib/precyflow/format'
import type { PrecyFlowProduct, PrecyFlowStore } from '@/lib/precyflow/types'

const schema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  description: z.string().optional(),
  logo_url: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().email('E-mail inválido').optional().or(z.literal('')),
})
type FormData = z.infer<typeof schema>

export function VitrineAdminClient({ store, initialProducts }: { store: PrecyFlowStore; initialProducts: PrecyFlowProduct[] }) {
  const [published, setPublished] = useState(store.published)
  const [products, setProducts] = useState(initialProducts)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: store.name,
      description: store.description ?? '',
      logo_url: store.logo_url ?? '',
      contact_phone: store.contact_phone ?? '',
      contact_email: store.contact_email ?? '',
    },
  })

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/precyflow/loja/${store.slug}` : `/precyflow/loja/${store.slug}`

  async function onSubmit(data: FormData) {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from('precyflow_stores')
        .update({
          name: data.name,
          description: data.description || null,
          logo_url: data.logo_url || null,
          contact_phone: data.contact_phone || null,
          contact_email: data.contact_email || null,
        })
        .eq('id', store.id)
      if (updateError) throw updateError
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function togglePublished() {
    const next = !published
    setPublished(next)
    const supabase = createClient()
    await supabase.from('precyflow_stores').update({ published: next }).eq('id', store.id)
  }

  async function toggleShowInStorefront(product: PrecyFlowProduct) {
    const next = !product.show_in_storefront
    setProducts(prev => prev.map(p => (p.id === product.id ? { ...p, show_in_storefront: next } : p)))
    const supabase = createClient()
    await supabase.from('precyflow_products').update({ show_in_storefront: next }).eq('id', product.id)
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--pf-text)' }}>Vitrine Virtual</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pf-text-secondary)' }}>Configure a loja pública dos seus clientes</p>
        </div>
      </div>

      <div className="pf-card mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--pf-primary) 12%, transparent)' }}
            >
              <Store size={20} style={{ color: 'var(--pf-primary)' }} />
            </div>
            <div>
              <div className="font-semibold" style={{ color: 'var(--pf-text)' }}>
                Status: {published ? 'Publicada' : 'Rascunho'}
              </div>
              <div className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>
                {published ? 'Seus clientes já podem acessar a vitrine' : 'Publique para liberar o link público'}
              </div>
            </div>
          </div>
          <button onClick={togglePublished} className={published ? 'pf-btn-secondary' : 'pf-btn-primary'}>
            {published ? 'Despublicar' : 'Publicar vitrine'}
          </button>
        </div>

        <div className="flex items-center gap-2 mt-4 rounded-xl px-3 py-2" style={{ border: '1px solid var(--pf-border)' }}>
          <span className="text-sm flex-1 truncate" style={{ color: 'var(--pf-text-secondary)' }}>{publicUrl}</span>
          <button onClick={copyLink} aria-label="Copiar link" style={{ color: 'var(--pf-text-secondary)' }}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          {published && (
            <a href={`/precyflow/loja/${store.slug}`} target="_blank" rel="noreferrer" aria-label="Abrir vitrine" style={{ color: 'var(--pf-primary)' }}>
              <ExternalLink size={16} />
            </a>
          )}
        </div>
      </div>

      <div className="pf-card mb-6">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--pf-text)' }}>Identidade da loja</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Nome</label>
            <input className="pf-input" {...register('name')} />
            {errors.name && <p className="mt-1 text-xs" style={{ color: 'var(--pf-error)' }}>{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Descrição</label>
            <textarea className="pf-input" rows={2} {...register('description')} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>URL do logo (opcional)</label>
            <input className="pf-input" placeholder="https://..." {...register('logo_url')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Telefone/WhatsApp</label>
              <input className="pf-input" {...register('contact_phone')} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>E-mail de contato</label>
              <input type="email" className="pf-input" {...register('contact_email')} />
              {errors.contact_email && <p className="mt-1 text-xs" style={{ color: 'var(--pf-error)' }}>{errors.contact_email.message}</p>}
            </div>
          </div>

          {error && <div className="text-sm px-4 py-3 rounded-xl" style={{ backgroundColor: 'var(--pf-error-bg)', color: 'var(--pf-error)' }}>{error}</div>}
          {saved && <div className="text-sm px-4 py-3 rounded-xl" style={{ backgroundColor: 'var(--pf-success-bg)', color: 'var(--pf-success)' }}>Salvo!</div>}

          <button type="submit" disabled={saving} className="pf-btn-primary">
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>

      <div className="pf-card !p-0 overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--pf-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--pf-text)' }}>Produtos visíveis na vitrine</h2>
        </div>
        {products.length === 0 ? (
          <p className="px-4 py-6 text-sm" style={{ color: 'var(--pf-text-secondary)' }}>Cadastre produtos ativos para exibi-los aqui.</p>
        ) : (
          <div>
            {products.map(product => (
              <div key={product.id} className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--pf-border)' }}>
                <div>
                  <div className="font-medium" style={{ color: 'var(--pf-text)' }}>{product.name}</div>
                  <div className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>{formatBRL(product.price)}</div>
                </div>
                <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--pf-text-secondary)' }}>
                  <input type="checkbox" checked={product.show_in_storefront} onChange={() => toggleShowInStorefront(product)} />
                  Exibir
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
