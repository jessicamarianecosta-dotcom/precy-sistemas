'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toaster'
import { useCompanyId } from '@/hooks/useCompanyId'
import { clsx } from 'clsx'
import {
  Store, LayoutGrid, Package, BookOpen, Settings, Plus, Trash2, Edit2,
  Search, CheckSquare, Square, Loader2, ExternalLink, ShoppingBag,
  TrendingUp, DollarSign, Tags, Copy, X,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { toSlug } from '@/lib/utils/slug'

type Tab = 'dashboard' | 'categorias' | 'produtos' | 'biblioteca' | 'configuracoes'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard',      label: 'Visão geral',   icon: LayoutGrid },
  { id: 'categorias',     label: 'Categorias',    icon: Tags },
  { id: 'produtos',       label: 'Produtos',      icon: Package },
  { id: 'biblioteca',     label: 'Biblioteca Precy+', icon: BookOpen },
  { id: 'configuracoes',  label: 'Configurações', icon: Settings },
]

export default function CatalogoPage() {
  const [tab, setTab] = useState<Tab>('dashboard')

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5">
      <Header title="Catálogo Online" subtitle="Sua loja própria, integrada com Pedidos, Financeiro e Estoque" />

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar border-b border-border dark:border-border-dark pb-px">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors border-b-2 -mb-px',
                active
                  ? 'text-primary border-primary'
                  : 'text-text-secondary dark:text-stone-400 border-transparent hover:text-primary'
              )}
            >
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'categorias' && <CategoriasTab />}
      {tab === 'produtos' && <ProdutosTab />}
      {tab === 'biblioteca' && <BibliotecaTab />}
      {tab === 'configuracoes' && <ConfiguracoesTab />}
    </div>
  )
}

/* ═══════════════════════════ DASHBOARD ═══════════════════════════ */

function StatCard({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-text-secondary dark:text-stone-400 mb-2">
        <Icon size={15} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-text-primary dark:text-stone-100">{value}</p>
      {hint && <p className="text-xs text-text-muted mt-1">{hint}</p>}
    </div>
  )
}

function DashboardTab() {
  const supabase = createClient()
  const { companyId } = useCompanyId()

  const { data, isLoading } = useQuery({
    queryKey: ['catalogo-dashboard', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const [{ count: categoriasCount }, { count: produtosCount }, { data: orders }] = await Promise.all([
        (supabase.from('catalog_categories') as any).select('id', { count: 'exact', head: true }).eq('company_id', companyId!),
        (supabase.from('products') as any).select('id', { count: 'exact', head: true }).eq('company_id', companyId!).eq('is_published_catalog', true),
        (supabase.from('orders') as any).select('id, total, payment_status').eq('company_id', companyId!).eq('source', 'catalog'),
      ])

      const paidOrders = (orders ?? []).filter((o: any) => o.payment_status === 'paid')
      const valorVendido = paidOrders.reduce((s: number, o: any) => s + Number(o.total), 0)
      const conversao = (orders ?? []).length > 0 ? (paidOrders.length / (orders ?? []).length) * 100 : 0

      const { data: topItems } = await (supabase.from('order_items') as any)
        .select('name, quantity, orders!inner(company_id, source)')
        .eq('orders.company_id', companyId!)
        .eq('orders.source', 'catalog')

      const byName = new Map<string, number>()
      for (const it of topItems ?? []) {
        byName.set(it.name, (byName.get(it.name) ?? 0) + Number(it.quantity))
      }
      const topProducts = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

      return {
        categorias: categoriasCount ?? 0,
        produtos: produtosCount ?? 0,
        pedidos: (orders ?? []).length,
        valorVendido,
        conversao,
        topProducts,
      }
    },
  })

  if (isLoading) return <div className="py-10 text-center text-text-muted text-sm">Carregando…</div>

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={Tags} label="Categorias" value={`${data?.categorias ?? 0} / 20`} />
        <StatCard icon={Package} label="Produtos publicados" value={`${data?.produtos ?? 0} / 500`} />
        <StatCard icon={ShoppingBag} label="Pedidos recebidos" value={String(data?.pedidos ?? 0)} />
        <StatCard icon={DollarSign} label="Valor vendido" value={formatCurrency(data?.valorVendido ?? 0)} />
        <StatCard icon={TrendingUp} label="Conversão" value={`${(data?.conversao ?? 0).toFixed(0)}%`} />
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-3">Produtos mais vendidos</h3>
        {(data?.topProducts?.length ?? 0) === 0 ? (
          <p className="text-sm text-text-muted">Nenhuma venda pelo Catálogo Online ainda.</p>
        ) : (
          <ul className="space-y-2">
            {data!.topProducts.map(([name, qty]) => (
              <li key={name} className="flex items-center justify-between text-sm">
                <span className="text-text-secondary dark:text-stone-300">{name}</span>
                <span className="font-semibold text-text-primary dark:text-stone-100">{qty} un.</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════ CATEGORIAS ═══════════════════════════ */

interface CatalogCategory { id: string; name: string; slug: string; sort_order: number }

function CategoriasTab() {
  const supabase = createClient()
  const { companyId } = useCompanyId()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<CatalogCategory | null>(null)

  const { data: categories, isLoading } = useQuery<CatalogCategory[]>({
    queryKey: ['catalog_categories', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('catalog_categories') as any)
        .select('id, name, slug, sort_order')
        .eq('company_id', companyId!)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      return data ?? []
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (name: string) => {
      const slug = toSlug(name)
      if (editing) {
        const { error } = await (supabase.from('catalog_categories') as any)
          .update({ name, slug })
          .eq('id', editing.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await (supabase.from('catalog_categories') as any)
          .insert([{ company_id: companyId, name, slug }])
        if (error) throw new Error(error.message.includes('Limite') ? error.message : `Erro ao criar categoria: ${error.message}`)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog_categories', companyId] })
      setNewName('')
      setEditing(null)
      toast('success', editing ? 'Categoria atualizada!' : 'Categoria criada!')
    },
    onError: (err: Error) => toast('error', err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('catalog_categories') as any).delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog_categories', companyId] })
      toast('success', 'Categoria removida')
    },
    onError: (err: Error) => toast('error', err.message),
  })

  const count = categories?.length ?? 0

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">
            {editing ? 'Editar categoria' : 'Nova categoria'}
          </h3>
          <span className="text-xs text-text-muted">{count} / 20 categorias</span>
        </div>
        <form
          onSubmit={e => { e.preventDefault(); if (newName.trim()) saveMutation.mutate(newName.trim()) }}
          className="flex gap-2"
        >
          <input
            className="input flex-1"
            placeholder="Nome da categoria"
            value={editing ? editing.name : newName}
            onChange={e => editing ? setEditing({ ...editing, name: e.target.value }) : setNewName(e.target.value)}
          />
          <button type="submit" disabled={saveMutation.isPending} className="btn-primary whitespace-nowrap">
            {saveMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {editing ? 'Salvar' : 'Adicionar'}
          </button>
          {editing && (
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Cancelar</button>
          )}
        </form>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-text-muted text-sm">Carregando…</div>
      ) : count === 0 ? (
        <EmptyState icon={Tags} title="Nenhuma categoria" description="Crie categorias para organizar os produtos da sua loja." />
      ) : (
        <div className="card divide-y divide-border dark:divide-border-dark">
          {categories!.map(cat => (
            <div key={cat.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-text-primary dark:text-stone-100">{cat.name}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setEditing(cat)} className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted hover:text-primary">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => deleteMutation.mutate(cat.id)} className="p-1.5 rounded-lg hover:bg-error-light text-text-muted hover:text-error">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════ PRODUTOS ═══════════════════════════ */

interface CatalogProduct {
  id: string
  name: string
  category: string
  final_price: number
  is_published_catalog: boolean
  catalog_category_id: string | null
  catalog_starting_price: number | null
  catalog_lead_time_days: number | null
}

function ProdutosTab() {
  const supabase = createClient()
  const { companyId } = useCompanyId()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: products, isLoading } = useQuery<CatalogProduct[]>({
    queryKey: ['catalogo_produtos', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('products') as any)
        .select('id, name, category, final_price, is_published_catalog, catalog_category_id, catalog_starting_price, catalog_lead_time_days')
        .eq('company_id', companyId!)
        .eq('is_active', true)
        .order('name', { ascending: true })
      return data ?? []
    },
  })

  const { data: categories } = useQuery<CatalogCategory[]>({
    queryKey: ['catalog_categories', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('catalog_categories') as any)
        .select('id, name, slug, sort_order')
        .eq('company_id', companyId!)
      return data ?? []
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, publish }: { id: string; publish: boolean }) => {
      const { error } = await (supabase.from('products') as any)
        .update({ is_published_catalog: publish })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogo_produtos', companyId] })
      queryClient.invalidateQueries({ queryKey: ['catalogo-dashboard', companyId] })
    },
    onError: (err: Error) => {
      toast('error', err.message.includes('Limite') || err.message.includes('PRO')
        ? err.message
        : `Não foi possível publicar: ${err.message}`)
    },
  })

  const categoryMutation = useMutation({
    mutationFn: async ({ id, categoryId }: { id: string; categoryId: string | null }) => {
      const { error } = await (supabase.from('products') as any)
        .update({ catalog_category_id: categoryId })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogo_produtos', companyId] }),
  })

  const filtered = (products ?? []).filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  const publishedCount = (products ?? []).filter(p => p.is_published_catalog).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input className="input pl-9" placeholder="Buscar produto…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="text-xs text-text-muted whitespace-nowrap">{publishedCount} / 500 publicados</span>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-text-muted text-sm">Carregando…</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="Nenhum produto" description="Cadastre produtos em Produtos ou importe da Biblioteca Precy+." />
      ) : (
        <div className="card divide-y divide-border dark:divide-border-dark">
          {filtered.map(p => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-medium text-text-primary dark:text-stone-100">{p.name}</p>
                <p className="text-xs text-text-muted">{formatCurrency(p.catalog_starting_price ?? p.final_price)}</p>
              </div>
              <select
                className="input text-xs py-1.5 w-40"
                value={p.catalog_category_id ?? ''}
                onChange={e => categoryMutation.mutate({ id: p.id, categoryId: e.target.value || null })}
              >
                <option value="">Sem categoria</option>
                {(categories ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button
                onClick={() => toggleMutation.mutate({ id: p.id, publish: !p.is_published_catalog })}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  p.is_published_catalog
                    ? 'bg-success-light text-success-dark'
                    : 'bg-surface dark:bg-white/5 text-text-secondary dark:text-stone-400 hover:bg-primary-50 hover:text-primary'
                )}
              >
                {p.is_published_catalog ? 'Publicado' : 'Publicar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════ BIBLIOTECA PRECY+ ═══════════════════════════ */

interface LibraryProduct {
  id: string; category_group: string; subcategory: string; name: string
  description: string | null; suggested_price: number | null; suggested_lead_time_days: number | null
}

function BibliotecaTab() {
  const supabase = createClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)

  const { data: items, isLoading } = useQuery<LibraryProduct[]>({
    queryKey: ['library_products'],
    queryFn: async () => {
      const { data } = await (supabase.from('library_products') as any)
        .select('id, category_group, subcategory, name, description, suggested_price, suggested_lead_time_days')
        .eq('is_active', true)
        .order('category_group', { ascending: true })
        .order('subcategory', { ascending: true })
      return data ?? []
    },
  })

  const categoryGroups = [...new Set((items ?? []).map(i => i.category_group))]
  const filtered = (items ?? []).filter(i =>
    (!categoryFilter || i.category_group === categoryFilter) &&
    (i.name.toLowerCase().includes(search.toLowerCase()) || i.subcategory.toLowerCase().includes(search.toLowerCase()))
  )

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(i => i.id)))
  }

  async function handleImport() {
    if (selected.size === 0) return
    setImporting(true)
    try {
      const res = await fetch('/api/catalogo/biblioteca/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao importar')
      toast('success', `${data.imported} produto(s) importado(s) para Produtos!`)
      setSelected(new Set())
    } catch (err: any) {
      toast('error', err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input className="input pl-9" placeholder="Buscar na biblioteca…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-56" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categoryGroups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <button onClick={toggleAll} className="btn-secondary">
          {selected.size === filtered.length && filtered.length > 0 ? <CheckSquare size={15} /> : <Square size={15} />}
          Selecionar todos
        </button>
        <button onClick={handleImport} disabled={selected.size === 0 || importing} className="btn-primary">
          {importing ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
          Importar Produtos {selected.size > 0 && `(${selected.size})`}
        </button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-text-muted text-sm">Carregando…</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="Nenhum item encontrado" description="Ajuste a busca ou o filtro de categoria." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(item => {
            const checked = selected.has(item.id)
            return (
              <button
                key={item.id}
                onClick={() => toggleOne(item.id)}
                className={clsx(
                  'card p-3 text-left transition-colors',
                  checked && 'ring-2 ring-primary'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-sm font-medium text-text-primary dark:text-stone-100">{item.name}</p>
                  {checked ? <CheckSquare size={16} className="text-primary flex-shrink-0" /> : <Square size={16} className="text-text-muted flex-shrink-0" />}
                </div>
                <p className="text-xs text-text-muted mb-1">{item.category_group} · {item.subcategory}</p>
                {item.suggested_price != null && (
                  <p className="text-xs font-semibold text-primary">{formatCurrency(item.suggested_price)}</p>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════ CONFIGURAÇÕES ═══════════════════════════ */

interface CatalogSettings {
  slug: string; logo_url: string | null; banner_url: string | null; description: string | null
  whatsapp: string | null; instagram: string | null; facebook: string | null; address: string | null
  theme_color: string; checkout_mode: 'buy' | 'quote'; policies_text: string | null
}

function ConfiguracoesTab() {
  const supabase = createClient()
  const { companyId } = useCompanyId()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CatalogSettings | null>(null)

  const { data, isLoading } = useQuery<CatalogSettings | null>({
    queryKey: ['catalog_settings', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('catalog_settings') as any)
        .select('slug, logo_url, banner_url, description, whatsapp, instagram, facebook, address, theme_color, checkout_mode, policies_text')
        .eq('company_id', companyId!)
        .maybeSingle()
      if (data) return data
      return {
        slug: '', logo_url: null, banner_url: null, description: null,
        whatsapp: null, instagram: null, facebook: null, address: null,
        theme_color: '#8B6C4F', checkout_mode: 'quote', policies_text: null,
      }
    },
  })

  const current = form ?? data ?? null

  const saveMutation = useMutation({
    mutationFn: async (settings: CatalogSettings) => {
      if (!settings.slug.trim()) throw new Error('Informe o endereço (slug) da loja')
      const { error } = await (supabase.from('catalog_settings') as any)
        .upsert([{ company_id: companyId, ...settings, slug: toSlug(settings.slug) }], { onConflict: 'company_id' })
      if (error) throw new Error(error.message.includes('duplicate') ? 'Esse endereço já está em uso por outra loja' : error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog_settings', companyId] })
      toast('success', 'Configurações salvas!')
    },
    onError: (err: Error) => toast('error', err.message),
  })

  async function uploadImage(file: File, context: 'logo' | 'banner') {
    const body = new FormData()
    body.append('file', file)
    body.append('context', context)
    const res = await fetch('/api/catalogo/upload', { method: 'POST', body })
    const json = await res.json()
    if (!res.ok) { toast('error', json.error ?? 'Erro ao enviar imagem'); return }
    setForm({ ...(current as CatalogSettings), [context === 'logo' ? 'logo_url' : 'banner_url']: json.url })
  }

  if (isLoading || !current) return <div className="py-8 text-center text-text-muted text-sm">Carregando…</div>

  return (
    <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(current) }} className="space-y-4">
      <div className="card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Endereço da loja</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted whitespace-nowrap">precyplus.com.br/loja/</span>
          <input
            className="input flex-1"
            placeholder="minha-loja"
            value={current.slug}
            onChange={e => setForm({ ...current, slug: e.target.value })}
          />
        </div>
        {current.slug && (
          <a href={`/loja/${toSlug(current.slug)}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Ver loja <ExternalLink size={12} />
          </a>
        )}
      </div>

      <div className="card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Identidade visual</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-muted mb-1 block">Logo</label>
            {current.logo_url && <img src={current.logo_url} alt="Logo" className="w-16 h-16 rounded-lg object-cover mb-2" />}
            <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], 'logo')} className="text-xs" />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Banner</label>
            {current.banner_url && <img src={current.banner_url} alt="Banner" className="w-full h-16 rounded-lg object-cover mb-2" />}
            <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], 'banner')} className="text-xs" />
          </div>
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Cor do tema</label>
          <input type="color" value={current.theme_color} onChange={e => setForm({ ...current, theme_color: e.target.value })} className="h-9 w-16 rounded-lg border border-border dark:border-border-dark" />
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Descrição da loja</label>
          <textarea className="input" rows={2} value={current.description ?? ''} onChange={e => setForm({ ...current, description: e.target.value })} />
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Contato e redes sociais</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className="input" placeholder="WhatsApp" value={current.whatsapp ?? ''} onChange={e => setForm({ ...current, whatsapp: e.target.value })} />
          <input className="input" placeholder="Instagram" value={current.instagram ?? ''} onChange={e => setForm({ ...current, instagram: e.target.value })} />
          <input className="input" placeholder="Facebook" value={current.facebook ?? ''} onChange={e => setForm({ ...current, facebook: e.target.value })} />
          <input className="input" placeholder="Endereço" value={current.address ?? ''} onChange={e => setForm({ ...current, address: e.target.value })} />
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Modo de compra padrão</h3>
        <div className="flex gap-2">
          {(['buy', 'quote'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setForm({ ...current, checkout_mode: mode })}
              className={clsx(
                'px-3 py-2 rounded-lg text-sm font-medium border',
                current.checkout_mode === mode
                  ? 'bg-primary text-white border-primary'
                  : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400'
              )}
            >
              {mode === 'buy' ? 'Comprar (checkout)' : 'Solicitar orçamento'}
            </button>
          ))}
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Políticas (trocas, entrega, etc.)</label>
          <textarea className="input" rows={3} value={current.policies_text ?? ''} onChange={e => setForm({ ...current, policies_text: e.target.value })} />
        </div>
      </div>

      <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
        {saveMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Store size={15} />}
        Salvar configurações
      </button>
    </form>
  )
}
