'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toaster'
import { useCompanyId } from '@/hooks/useCompanyId'
import {
  Package, Plus, Search, Edit2, Trash2, X, Loader2,
  Copy, ExternalLink, DollarSign, Clock, Layers,
  TrendingUp, ChevronRight, Tag, Zap,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import React, { useState } from 'react'
import { clsx } from 'clsx'
import Link from 'next/link'
import { CategorySelect } from '@/components/ui/CategorySelect'
import { formatCurrency } from '@/lib/utils/format'

/* ─── Types ─── */
interface Product {
  id:                    string
  company_id:            string
  name:                  string
  description?:          string | null
  category:              string
  unit:                  string
  product_type?:         string | null
  production_time_hours: number
  material_cost:         number
  labor_cost?:           number
  extra_cost?:           number
  total_cost?:           number
  purchase_cost?:        number
  markup_percentage:     number
  final_price:           number
  is_active:             boolean
  created_at:            string
}

interface ProductMaterial {
  id:            string
  inventory_id?: string | null
  material_name: string
  quantity:      number
  unit:          string
  unit_cost:     number
  subtotal:      number
}

/* ─── Schema (form de criação/edição básica) ─── */
const schema = z.object({
  name:                  z.string().min(2, 'Nome obrigatório'),
  description:           z.string().optional(),
  category:              z.string().min(1, 'Categoria obrigatória'),
  unit:                  z.string().default('un'),
  production_time_hours: z.coerce.number().min(0),
  material_cost:         z.coerce.number().min(0),
  markup_percentage:     z.coerce.number().min(0),
  final_price:           z.coerce.number().min(0),
})
type FormData = z.infer<typeof schema>

/* ─── Helpers ─── */
function fmt(v: number | null | undefined) {
  return formatCurrency(v)
}
function safeNum(v: unknown) { return Number(v ?? 0) }

/* ─── Sub-component: Ficha section ─── */
function FichaSection({
  icon: Icon, title, color = 'text-primary', bg = 'bg-primary-50 dark:bg-primary/10', children,
}: {
  icon: React.ElementType; title: string; color?: string; bg?: string; children: React.ReactNode
}) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2.5 pb-2 border-b border-border dark:border-border-dark">
        <div className={clsx('p-1.5 rounded-lg flex-shrink-0', bg)}>
          <Icon size={15} className={color} />
        </div>
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">{title}</h3>
      </div>
      {children}
    </div>
  )
}

/* ─── Page ─── */
export default function ProdutosPage() {
  const supabase      = createClient()
  const qc            = useQueryClient()
  const { toast }     = useToast()
  const { companyId } = useCompanyId()

  /* ui state */
  const [showForm,      setShowForm]      = useState(false)
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [viewProduct,   setViewProduct]   = useState<Product | null>(null)
  const [search,        setSearch]        = useState('')
  const [deleteId,      setDeleteId]      = useState<string | null>(null)
  const [duplicating,   setDuplicating]   = useState(false)

  /* ── Queries ── */
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['products', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data, error } = await (supabase.from('products') as any)
        .select('*').eq('company_id', companyId!).order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  /* Materiais do produto selecionado */
  const { data: productMaterials } = useQuery<ProductMaterial[]>({
    queryKey: ['product-materials', viewProduct?.id],
    enabled:  !!viewProduct?.id,
    queryFn:  async () => {
      const { data } = await (supabase.from('product_materials') as any)
        .select('*').eq('product_id', viewProduct!.id).order('created_at')
      return (data ?? []) as ProductMaterial[]
    },
  })

  /* ── Form ── */
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { unit: 'un', markup_percentage: 100, production_time_hours: 1, material_cost: 0, final_price: 0 },
  })
  const categoryValue = watch('category') ?? ''

  /* ── Mutations ── */
  const saveMutation = useMutation({
    mutationFn: async (d: FormData) => {
      if (editingId) {
        const { error } = await (supabase.from('products') as any)
          .update({ ...d, updated_at: new Date().toISOString() }).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await (supabase.from('products') as any)
          .insert([{ ...d, company_id: companyId!, is_active: true }]).select()
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products', companyId] })
      qc.invalidateQueries({ queryKey: ['dashboard', companyId] })
      toast('success', editingId ? 'Produto atualizado!' : 'Produto cadastrado!')
      closeForm()
    },
    onError: (err: Error) => {
      console.error('[produtos] save error:', err)
      toast('error', `Erro ao salvar: ${err.message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Verificar dependências antes de deletar
      const [{ count: orderCount }, { count: budgetCount }] = await Promise.all([
        (supabase.from('order_items') as any)
          .select('id', { count: 'exact', head: true })
          .eq('product_id', id),
        (supabase.from('budget_items') as any)
          .select('id', { count: 'exact', head: true })
          .eq('product_id', id),
      ])

      if ((orderCount ?? 0) > 0 || (budgetCount ?? 0) > 0) {
        const parts: string[] = []
        if ((orderCount ?? 0) > 0) parts.push(`${orderCount} pedido${orderCount === 1 ? '' : 's'}`)
        if ((budgetCount ?? 0) > 0) parts.push(`${budgetCount} orçamento${budgetCount === 1 ? '' : 's'}`)
        throw new Error(`LINKED:${parts.join(' e ')}`)
      }

      // Deletar materiais do produto antes (caso FK não tenha CASCADE)
      await (supabase.from('product_materials') as any)
        .delete()
        .eq('product_id', id)

      const { error } = await (supabase.from('products') as any).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products', companyId] })
      qc.invalidateQueries({ queryKey: ['dashboard', companyId] })
      toast('success', 'Produto removido com sucesso.')
      setDeleteId(null)
      if (viewProduct?.id === deleteId) setViewProduct(null)
    },
    onError: (err: Error) => {
      console.error('[produtos] delete error:', err)
      if (err.message.startsWith('LINKED:')) {
        const detail = err.message.replace('LINKED:', '')
        toast('error', `Não é possível excluir: este produto está vinculado a ${detail}. Remova os vínculos primeiro.`)
      } else if (err.message.includes('foreign key') || err.message.includes('violates')) {
        toast('error', 'Não é possível excluir: produto vinculado a pedidos ou orçamentos existentes.')
      } else {
        toast('error', `Erro ao excluir: ${err.message}`)
      }
      setDeleteId(null)
    },
  })

  /* ── Duplicar produto ── */
  async function handleDuplicate(p: Product) {
    if (!companyId) return
    setDuplicating(true)
    try {
      const { id: _id, created_at: _c, ...rest } = p as any
      const { data: newProd, error } = await (supabase.from('products') as any)
        .insert({ ...rest, company_id: companyId, name: `Cópia de ${p.name}` })
        .select('id').single()
      if (error) throw error

      // Duplicar materiais se existirem
      if (productMaterials && productMaterials.length > 0 && newProd?.id) {
        const rows = productMaterials.map(({ id: _mid, ...m }) => ({
          ...m,
          company_id: companyId,
          product_id: newProd.id,
        }))
        await (supabase.from('product_materials') as any).insert(rows)
      }

      qc.invalidateQueries({ queryKey: ['products', companyId] })
      toast('success', `"${p.name} (cópia)" criado!`)
    } catch (err: unknown) {
      const e = err as Error
      console.error('[produtos] duplicate error:', e)
      toast('error', `Erro ao duplicar: ${e.message}`)
    } finally {
      setDuplicating(false)
    }
  }

  /* ── Handlers ── */
  function openEdit(p: Product) {
    setEditingId(p.id)
    ;(['name','description','category','unit','production_time_hours','material_cost','markup_percentage','final_price'] as Array<keyof FormData>)
      .forEach(k => setValue(k, (p as unknown as Record<string, unknown>)[k] as string))
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); reset(); setEditingId(null) }

  const filtered = (products ?? []).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  )

  /* ── Dados derivados do produto em view ── */
  // Sincronizar viewProduct com dados frescos do banco (ex: após recalculo por trigger)
  const vp = viewProduct?.id
    ? (products?.find(p => p.id === viewProduct.id) ?? viewProduct)
    : viewProduct
  const vpMaterials  = productMaterials ?? []
  const vpTotalMats  = vpMaterials.reduce((s, m) => s + safeNum(m.subtotal), 0)
  const vpLaborCost  = safeNum(vp?.labor_cost)
  const vpExtraCost  = safeNum(vp?.extra_cost)
  const vpTotalCost  = safeNum(vp?.total_cost) || (vpTotalMats + vpLaborCost + vpExtraCost)
  const vpFinalPrice = safeNum(vp?.final_price)
  const vpProfit     = vpFinalPrice - vpTotalCost
  const vpMargin     = vpFinalPrice > 0 ? (vpProfit / vpFinalPrice) * 100 : 0
  const vpMarkup     = safeNum(vp?.markup_percentage)

  /* cenários calculados */
  const vpScenarios = vp ? [
    { label: 'Conservador', sub: 'Preço competitivo', markup: Math.max(30, Math.round(vpMarkup * 0.5)), color: 'text-warning', bg: 'bg-warning-light dark:bg-warning/10' },
    { label: 'Ideal',       sub: 'Lucro saudável',    markup: vpMarkup,                                 color: 'text-success', bg: 'bg-success-light dark:bg-success/10', active: true },
    { label: 'Premium',     sub: 'Posicionamento alto', markup: Math.round(vpMarkup * 1.6),             color: 'text-primary', bg: 'bg-primary-50 dark:bg-primary/10' },
  ] : []

  /* ══════════════════════════════════════════════ */
  return (
    <div className="page-enter">
      <Header title="Produtos" subtitle="Gerencie seu catálogo de produtos" />
      <div className="p-3 sm:p-5 lg:p-6 space-y-4">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="text" placeholder="Buscar produtos..." className="input pl-9"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => { reset(); setEditingId(null); setShowForm(true) }}
            className="btn-primary flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
            <Plus size={16} /> Novo Produto
          </button>
        </div>

        {/* Tabela */}
        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-6"><SkeletonTable rows={5} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Package} title="Nenhum produto cadastrado"
              description="Cadastre seus produtos para usar em pedidos e orçamentos."
              action={{ label: '+ Novo Produto', onClick: () => setShowForm(true) }} />
          ) : (
            <>
              {/* ── MOBILE: cards ── */}
              <div className="md:hidden divide-y divide-border dark:divide-border-dark">
                {filtered.map(p => (
                  <div key={p.id}
                    className="p-4 hover:bg-primary-50/20 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setViewProduct(p)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Package size={16} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-primary dark:text-stone-100 leading-snug break-words">{p.name}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <span className="badge badge-primary">{p.category}</span>
                              {p.product_type && (
                                <span className="badge badge-info text-[9px]">
                                  {p.product_type === 'produced' ? 'Produzido' : 'Revenda'}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-base font-bold text-primary flex-shrink-0">{fmt(p.final_price)}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-text-secondary dark:text-stone-400">
                          <span>Custo: {fmt(safeNum(p.total_cost) || safeNum(p.material_cost))}</span>
                          <span>Margem: {p.markup_percentage}%</span>
                        </div>
                        <div className="flex items-center gap-2 mt-3" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setViewProduct(p)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border border-border dark:border-border-dark hover:border-primary hover:text-primary transition-colors">
                            <Edit2 size={12} /> Ficha técnica
                          </button>
                          <button onClick={() => handleDuplicate(p)}
                            disabled={duplicating}
                            className="p-1.5 rounded-lg text-text-muted hover:text-info hover:bg-info-light transition-colors" title="Duplicar">
                            <Copy size={14} />
                          </button>
                          <button onClick={() => setDeleteId(p.id)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── DESKTOP: tabela ── */}
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border dark:border-border-dark">
                      {['Produto', 'Categoria', 'Custo total', 'Margem', 'Preço Final', 'Ações'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider p-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => (
                      <tr key={p.id}
                        className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/30 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                        onClick={() => setViewProduct(p)}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Package size={15} className="text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-text-primary dark:text-stone-100">{p.name}</p>
                              <p className="text-xs text-text-muted">{p.unit} · {p.production_time_hours}h</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            <span className="badge badge-primary">{p.category}</span>
                            {p.product_type && (
                              <span className="badge badge-info text-[9px]">
                                {p.product_type === 'produced' ? 'Produzido' : 'Revenda'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-text-secondary dark:text-stone-300">
                          {fmt(safeNum(p.total_cost) || safeNum(p.material_cost))}
                        </td>
                        <td className="p-4 text-sm text-text-secondary dark:text-stone-300">{p.markup_percentage}%</td>
                        <td className="p-4"><span className="text-sm font-bold text-primary">{fmt(p.final_price)}</span></td>
                        <td className="p-4" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setViewProduct(p)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors" title="Ver ficha técnica">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDuplicate(p)}
                              disabled={duplicating}
                              className="p-1.5 rounded-lg text-text-muted hover:text-info hover:bg-info-light transition-colors" title="Duplicar">
                              <Copy size={14} />
                            </button>
                            <button onClick={() => setDeleteId(p.id)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors" title="Excluir">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          MODAL: FICHA TÉCNICA DO PRODUTO
      ════════════════════════════════════════ */}
      {viewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setViewProduct(null)} />
          <div className="relative bg-background dark:bg-background-dark w-full max-w-2xl max-h-[95dvh] sm:max-h-[92vh] flex flex-col rounded-2xl shadow-modal animate-scaleIn overflow-hidden">

            {/* Header */}
            <div className="flex items-start justify-between p-4 sm:p-5 border-b border-border dark:border-border-dark flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(139,108,79,0.07), rgba(184,149,106,0.04))' }}>
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Package size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-text-primary dark:text-stone-100 truncate">{vp?.name}</h2>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="badge badge-primary">{vp?.category}</span>
                    {vp?.product_type && (
                      <span className={clsx('badge', vp.product_type === 'produced' ? 'badge-info' : 'badge-warning')}>
                        {vp.product_type === 'produced' ? '🔨 Produzido' : '🛍️ Revenda'}
                      </span>
                    )}
                    <span className="badge badge-primary text-[9px]">{vp?.unit}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setViewProduct(null)}
                className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted flex-shrink-0 ml-2">
                <X size={16} />
              </button>
            </div>

            {/* Body (scrollable) */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">

              {/* ── S1: Dados do produto ── */}
              <FichaSection icon={Tag} title="Dados do produto">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Categoria',   value: vp?.category },
                    { label: 'Unidade',     value: vp?.unit },
                    { label: 'Tipo',        value: vp?.product_type === 'produced' ? 'Produzido' : vp?.product_type === 'resale' ? 'Revenda' : '—' },
                    { label: 'Prod. (horas)', value: vp?.production_time_hours ? `${vp.production_time_hours}h` : '—' },
                  ].map(item => (
                    <div key={item.label} className="rounded-xl p-2.5 bg-primary-50/50 dark:bg-primary/5">
                      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{item.label}</p>
                      <p className="text-sm font-semibold text-text-primary dark:text-stone-100">{item.value || '—'}</p>
                    </div>
                  ))}
                </div>
                {vp?.description && (
                  <p className="text-xs text-text-secondary dark:text-stone-400 mt-1 leading-relaxed">{vp.description}</p>
                )}
              </FichaSection>

              {/* ── S2: Materiais ── */}
              <FichaSection icon={Layers} title="Materiais utilizados"
                color="text-info" bg="bg-info-light dark:bg-info/10">
                {vpMaterials.length > 0 ? (
                  <div className="space-y-1">
                    {/* Badge de sincronização quando há vínculos com estoque */}
                    {vpMaterials.some(m => m.inventory_id) && (
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-success-light dark:bg-success/10 border border-success/20 mb-2">
                        <Zap size={11} className="text-success flex-shrink-0" />
                        <p className="text-[10px] text-success-dark dark:text-success font-medium">
                          Custos sincronizados com o estoque — atualizam automaticamente
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-4 gap-2 px-1 pb-1 border-b border-border dark:border-border-dark">
                      {['Material', 'Qtd', 'Unit.', 'Subtotal'].map(h => (
                        <span key={h} className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">{h}</span>
                      ))}
                    </div>
                    {vpMaterials.map(m => (
                      <div key={m.id} className="grid grid-cols-4 gap-2 px-1 py-1.5 rounded-lg hover:bg-primary-50/30 dark:hover:bg-white/[0.02]">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-xs text-text-primary dark:text-stone-200 truncate">{m.material_name}</span>
                          {m.inventory_id && (
                            <Zap size={9} className="text-success flex-shrink-0" />
                          )}
                        </div>
                        <span className="text-xs text-text-secondary dark:text-stone-400">{safeNum(m.quantity)} {m.unit}</span>
                        <span className="text-xs text-text-secondary dark:text-stone-400">{fmt(m.unit_cost)}</span>
                        <span className="text-xs font-semibold text-info-dark dark:text-info">{fmt(m.subtotal)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t border-border dark:border-border-dark px-1">
                      <span className="text-xs font-semibold text-text-primary dark:text-stone-100">Total materiais</span>
                      <span className="text-sm font-bold text-info-dark dark:text-info">{fmt(vpTotalMats)}</span>
                    </div>
                  </div>
                ) : safeNum(vp?.material_cost) > 0 ? (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-text-secondary dark:text-stone-400">Custo de material registrado</span>
                    <span className="text-sm font-bold text-info-dark dark:text-info">{fmt(vp?.material_cost)}</span>
                  </div>
                ) : (
                  <p className="text-xs text-text-muted dark:text-stone-500 text-center py-2">Nenhum material vinculado.</p>
                )}
              </FichaSection>

              {/* ── S3: Mão de obra ── */}
              {vpLaborCost > 0 && (
                <FichaSection icon={Clock} title="Mão de obra"
                  color="text-warning" bg="bg-warning-light dark:bg-warning/10">
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-xs text-text-secondary dark:text-stone-400">
                        {vp?.production_time_hours
                          ? `${vp.production_time_hours}h de produção`
                          : 'Tempo de produção'}
                      </p>
                      <p className="text-[10px] text-text-muted dark:text-stone-500 mt-0.5">
                        Calculado com base no custo/hora configurado
                      </p>
                    </div>
                    <span className="text-sm font-bold text-warning-dark dark:text-warning">{fmt(vpLaborCost)}</span>
                  </div>
                </FichaSection>
              )}

              {/* ── S4: Custos extras ── */}
              {vpExtraCost > 0 && (
                <FichaSection icon={DollarSign} title="Custos extras"
                  color="text-error" bg="bg-error-light dark:bg-error/10">
                  <div className="flex items-center justify-between py-1">
                    <p className="text-xs text-text-secondary dark:text-stone-400">
                      Embalagem, entrega, etiquetas, etc.
                    </p>
                    <span className="text-sm font-bold text-error-dark dark:text-error">{fmt(vpExtraCost)}</span>
                  </div>
                </FichaSection>
              )}

              {/* ── S5: Composição do preço ── */}
              <FichaSection icon={DollarSign} title="Composição do preço"
                color="text-success" bg="bg-success-light dark:bg-success/10">
                <div className="space-y-2">
                  {[
                    { label: 'Materiais / Compra',  value: vpTotalMats > 0 ? vpTotalMats : safeNum(vp?.material_cost || vp?.purchase_cost), color: 'text-info-dark dark:text-info'       },
                    vpLaborCost > 0 && { label: 'Mão de obra',         value: vpLaborCost,  color: 'text-warning-dark dark:text-warning'   },
                    vpExtraCost > 0 && { label: 'Custos extras',        value: vpExtraCost,  color: 'text-error-dark dark:text-error'       },
                    { label: 'Custo total',          value: vpTotalCost,  color: 'text-text-primary dark:text-stone-100', bold: true },
                    vpProfit > 0 && { label: `Lucro (${vpMarkup}%)`,    value: vpProfit,     color: 'text-success-dark dark:text-success', bold: true },
                  ].filter(Boolean).map((row: unknown) => {
                    const r = row as { label: string; value: number; color: string; bold?: boolean }
                    return (
                      <div key={r.label} className="flex items-center justify-between py-1 border-b border-border dark:border-border-dark last:border-0">
                        <span className="text-xs text-text-secondary dark:text-stone-400">{r.label}</span>
                        <span className={clsx('text-sm', r.bold ? 'font-bold' : 'font-medium', r.color)}>{fmt(r.value)}</span>
                      </div>
                    )
                  })}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm font-bold text-text-primary dark:text-stone-100">Preço Final</span>
                    <span className="text-xl font-bold text-primary">{fmt(vpFinalPrice)}</span>
                  </div>
                </div>
              </FichaSection>

              {/* ── S6: Cenários de preço ── */}
              <FichaSection icon={TrendingUp} title="Cenários de preço"
                color="text-primary" bg="bg-primary-50 dark:bg-primary/10">
                <div className="grid grid-cols-3 gap-2">
                  {vpScenarios.map(s => {
                    const price = vpTotalCost * (1 + s.markup / 100)
                    return (
                      <div key={s.label}
                        className={clsx(
                          'rounded-xl p-3 text-center border transition-all',
                          s.active
                            ? 'border-primary bg-primary-50 dark:bg-primary/10'
                            : 'border-border dark:border-border-dark'
                        )}
                      >
                        <p className={clsx('text-xs font-semibold mb-0.5', s.color)}>{s.label}</p>
                        <p className="text-[10px] text-text-muted dark:text-stone-500 mb-1.5">{s.sub}</p>
                        <p className={clsx('text-sm font-bold', s.active ? 'text-primary' : 'text-text-primary dark:text-stone-100')}>
                          {fmt(price)}
                        </p>
                        <p className="text-[9px] text-text-muted dark:text-stone-500 mt-0.5">{s.markup}% margem</p>
                      </div>
                    )
                  })}
                </div>
              </FichaSection>

            </div>

            {/* Footer: ações */}
            <div className="flex-shrink-0 p-3 sm:p-4 border-t border-border dark:border-border-dark grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => { openEdit(viewProduct!); }}
                className="btn-secondary flex items-center justify-center gap-1.5 text-xs py-2.5"
              >
                <Edit2 size={13} /> Editar dados
              </button>

              <Link
                href={`/precificacao?productId=${viewProduct?.id}`}
                className="btn-secondary flex items-center justify-center gap-1.5 text-xs py-2.5"
                onClick={() => setViewProduct(null)}
              >
                <ExternalLink size={13} /> Precificação
              </Link>

              <button
                onClick={() => { handleDuplicate(viewProduct!); }}
                disabled={duplicating}
                className="btn-secondary flex items-center justify-center gap-1.5 text-xs py-2.5 col-span-1"
              >
                {duplicating ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                {duplicating ? 'Duplicando...' : 'Duplicar'}
              </button>

              <button
                onClick={() => { setDeleteId(viewProduct!.id); setViewProduct(null); }}
                className="flex items-center justify-center gap-1.5 text-xs py-2.5 px-3 rounded-xl text-error border border-error/30 hover:bg-error-light dark:hover:bg-error/10 transition-all"
              >
                <Trash2 size={13} /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          MODAL: FORM CRIAR / EDITAR BÁSICO
      ════════════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-lg animate-scaleIn max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-surface-dark p-4 sm:p-5 pb-3 border-b border-border dark:border-border-dark rounded-t-2xl z-10 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-text-primary dark:text-stone-100">
                  {editingId ? 'Editar dados básicos' : 'Novo Produto'}
                </h2>
                {editingId && (
                  <p className="text-xs text-text-muted mt-0.5">
                    Para editar materiais e composição, use{' '}
                    <button className="text-primary underline" onClick={() => { closeForm(); setViewProduct(products?.find(p => p.id === editingId) ?? null) }}>
                      a ficha técnica
                    </button>
                    {' '}ou a Precificação.
                  </p>
                )}
              </div>
              <button onClick={closeForm} className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted ml-2"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Nome *</label>
                  <input className="input" placeholder="Ex: Copo personalizado" {...register('name')} />
                  {errors.name && <p className="mt-1 text-xs text-error">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Categoria *</label>
                  <CategorySelect
                    value={categoryValue}
                    onChange={v => setValue('category', v, { shouldValidate: true })}
                    placeholder="Selecione ou crie..."
                  />
                  {errors.category && <p className="mt-1 text-xs text-error">{errors.category.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Unidade</label>
                  <select className="input" {...register('unit')}>
                    {['un','kg','g','ml','m','par'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Custo de Material (R$)</label>
                  <input type="number" step="0.01" className="input" placeholder="0,00" {...register('material_cost')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Tempo de Produção (h)</label>
                  <input type="number" step="0.1" className="input" placeholder="1" {...register('production_time_hours')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Margem de Lucro (%)</label>
                  <input type="number" step="1" className="input" placeholder="100" {...register('markup_percentage')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Preço Final (R$)</label>
                  <input type="number" step="0.01" className="input" placeholder="0,00" {...register('final_price')} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Descrição</label>
                  <textarea rows={2} className="input resize-none" placeholder="Descrição opcional" {...register('description')} />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button type="button" onClick={closeForm} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saveMutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saveMutation.isPending && <Loader2 size={15} className="animate-spin" />}
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          MODAL: CONFIRMAR EXCLUSÃO
      ════════════════════════════════════════ */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleteMutation.isPending && setDeleteId(null)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm animate-scaleIn p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-error-light flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-error" />
            </div>
            <h3 className="text-base font-semibold text-text-primary dark:text-stone-100 mb-2">Excluir produto?</h3>
            <p className="text-sm text-text-secondary dark:text-stone-400 mb-1">Esta ação não pode ser desfeita.</p>
            <p className="text-xs text-text-muted dark:text-stone-500 mb-6">
              Os materiais vinculados serão removidos. Pedidos e orçamentos que já usaram este produto serão preservados.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleteMutation.isPending}
                className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={() => deleteMutation.mutate(deleteId!)}
                disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-error hover:opacity-90 disabled:opacity-50">
                {deleteMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                {deleteMutation.isPending ? 'Verificando...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
