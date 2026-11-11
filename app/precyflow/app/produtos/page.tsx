'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Package, Pencil, Archive, ArchiveRestore, Image as ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePrecyflowCompany } from '@/hooks/usePrecyflowCompany'
import { formatCurrency } from '@/lib/utils/format'
import { PrecyflowHeader } from '@/components/precyflow/Header'
import { PrecyflowModal } from '@/components/precyflow/Modal'
import { PrecyflowEmptyState } from '@/components/precyflow/EmptyState'

interface Product {
  id: string
  name: string
  description: string | null
  category: string
  final_price: number
  is_active: boolean
  image_url: string | null
}

type StatusFilter = 'todos' | 'ativo' | 'inativo'

function useProducts(companyId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['precyflow-produtos', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from('products')
        .select('id, name, description, category, final_price, is_active, image_url')
        .eq('company_id', companyId as string)
        .order('created_at', { ascending: false }) as any
      if (error) throw error
      return (data ?? []) as Product[]
    },
  })
}

const emptyForm = { name: '', description: '', category: 'geral', final_price: '', image_url: '' }

export default function PrecyflowProdutosPage() {
  const { companyId, companyName } = usePrecyflowCompany()
  const { data: products, isLoading } = useProducts(companyId)
  const queryClient = useQueryClient()
  const supabase = createClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [categoryFilter, setCategoryFilter] = useState('todas')
  const [editing, setEditing] = useState<Product | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categories = Array.from(new Set((products ?? []).map(p => p.category))).sort()

  const filtered = (products ?? []).filter(p => {
    if (statusFilter === 'ativo' && !p.is_active) return false
    if (statusFilter === 'inativo' && p.is_active) return false
    if (categoryFilter !== 'todas' && p.category !== categoryFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError(null)
    setShowForm(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      name: p.name,
      description: p.description ?? '',
      category: p.category,
      final_price: String(p.final_price),
      image_url: p.image_url ?? '',
    })
    setError(null)
    setShowForm(true)
  }

  async function handleSave() {
    if (!companyId) return
    if (!form.name.trim()) { setError('Informe o nome do produto.'); return }
    const price = Number(form.final_price.replace(',', '.'))
    if (!form.final_price || Number.isNaN(price) || price < 0) { setError('Informe um preço de venda válido.'); return }

    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || 'geral',
        final_price: price,
        image_url: form.image_url.trim() || null,
      }
      if (editing) {
        const { error: err } = await (supabase.from('products') as any).update(payload).eq('id', editing.id)
        if (err) throw err
      } else {
        const { error: err } = await (supabase.from('products') as any).insert({ ...payload, company_id: companyId, is_active: true })
        if (err) throw err
      }
      await queryClient.invalidateQueries({ queryKey: ['precyflow-produtos', companyId] })
      setShowForm(false)
    } catch (e: any) {
      setError(e?.message?.includes('Limite de 300')
        ? 'Limite de 300 produtos cadastrados atingido no plano PrecyFlow.'
        : 'Não foi possível salvar o produto. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(p: Product) {
    await (supabase.from('products') as any).update({ is_active: !p.is_active }).eq('id', p.id)
    queryClient.invalidateQueries({ queryKey: ['precyflow-produtos', companyId] })
  }

  return (
    <div>
      <PrecyflowHeader title="Produtos" subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex flex-1 flex-col sm:flex-row gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--pf-text-muted)' }} />
              <input
                className="input pl-9" placeholder="Buscar produto..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="input sm:w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="todos">Todos os status</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
            <select className="input sm:w-44" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="todas">Todas categorias</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={openCreate} className="pf-btn-primary flex items-center justify-center gap-2 px-4 py-2.5 whitespace-nowrap">
            <Plus size={16} /> Novo produto
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="pf-card h-48 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="pf-card">
            <PrecyflowEmptyState
              icon={Package}
              title={products?.length ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado ainda'}
              subtitle={products?.length ? 'Tente ajustar a busca ou os filtros.' : 'Cadastre o primeiro produto do seu catálogo.'}
              action={!products?.length && (
                <button onClick={openCreate} className="pf-btn-primary px-4 py-2">Novo produto</button>
              )}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map(p => (
              <div key={p.id} className="pf-card overflow-hidden flex flex-col">
                <div className="aspect-square flex items-center justify-center pf-bg-primary-soft">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={28} className="pf-text-primary-accent opacity-60" />
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col gap-1">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--pf-text-secondary)' }}>{p.category}</p>
                  <p className="text-sm font-bold mt-1">{formatCurrency(Number(p.final_price))}</p>
                  <div className="flex items-center justify-between mt-auto pt-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.is_active ? 'bg-success-light text-success-dark' : 'bg-error-light text-error-dark'}`}>
                      {p.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:pf-bg-primary-soft" title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => toggleActive(p)} className="p-1.5 rounded-lg hover:pf-bg-primary-soft" title={p.is_active ? 'Arquivar' : 'Reativar'}>
                        {p.is_active ? <Archive size={14} /> : <ArchiveRestore size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <PrecyflowModal title={editing ? 'Editar produto' : 'Novo produto'} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nome</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Laço de cetim P" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Descrição</label>
              <textarea className="input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Categoria</label>
                <input className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Ex: laços" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Preço de venda (R$)</label>
                <input className="input" inputMode="decimal" value={form.final_price} onChange={e => setForm(f => ({ ...f, final_price: e.target.value }))} placeholder="0,00" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">URL da foto (opcional)</label>
              <input className="input" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
            </div>
            {error && <div className="bg-error-light text-error-dark text-sm px-4 py-3 rounded-xl">{error}</div>}
            <button onClick={handleSave} disabled={saving} className="pf-btn-primary w-full py-2.5 mt-2">
              {saving ? 'Salvando...' : 'Salvar produto'}
            </button>
          </div>
        </PrecyflowModal>
      )}
    </div>
  )
}
