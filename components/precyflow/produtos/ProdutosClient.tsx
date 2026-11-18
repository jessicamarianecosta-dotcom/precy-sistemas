'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Package, Plus, Search, Pencil, Archive, ArchiveRestore, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/precyflow/supabase-client'
import { formatBRL } from '@/lib/precyflow/format'
import { EmptyState } from '@/components/precyflow/EmptyState'
import { Modal } from '@/components/precyflow/Modal'
import type { PrecyFlowProduct } from '@/lib/precyflow/types'

const schema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  category: z.string().min(1, 'Informe a categoria'),
  sku: z.string().optional(),
  price: z.coerce.number().min(0, 'Preço inválido'),
  stock_quantity: z.coerce.number().min(0, 'Estoque inválido'),
  minimum_quantity: z.coerce.number().min(0).optional(),
  description: z.string().optional(),
  image_url: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export function ProdutosClient({ storeId, initialProducts }: { storeId: string; initialProducts: PrecyFlowProduct[] }) {
  const [products, setProducts] = useState(initialProducts)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativos' | 'inativos'>('ativos')
  const [editing, setEditing] = useState<PrecyFlowProduct | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return products
      .filter(p => statusFilter === 'todos' || (statusFilter === 'ativos' ? p.is_active : !p.is_active))
      .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(search.toLowerCase()))
  }, [products, search, statusFilter])

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  function openNew() {
    setEditing(null)
    reset({ name: '', category: 'geral', sku: '', price: 0, stock_quantity: 0, minimum_quantity: 0, description: '', image_url: '' })
    setShowForm(true)
  }

  function openEdit(product: PrecyFlowProduct) {
    setEditing(product)
    reset({
      name: product.name,
      category: product.category,
      sku: product.sku ?? '',
      price: product.price,
      stock_quantity: product.stock_quantity,
      minimum_quantity: product.minimum_quantity,
      description: product.description ?? '',
      image_url: product.image_url ?? '',
    })
    setShowForm(true)
  }

  async function onSubmit(data: FormData) {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const payload = {
        store_id: storeId,
        name: data.name,
        category: data.category,
        sku: data.sku || null,
        price: data.price,
        stock_quantity: data.stock_quantity,
        minimum_quantity: data.minimum_quantity ?? 0,
        description: data.description || null,
        image_url: data.image_url || null,
      }

      if (editing) {
        const { data: updated, error: updateError } = await supabase
          .from('precyflow_products').update(payload).eq('id', editing.id).select().single()
        if (updateError) throw updateError
        setProducts(prev => prev.map(p => (p.id === editing.id ? (updated as PrecyFlowProduct) : p)))
      } else {
        const { data: created, error: insertError } = await supabase
          .from('precyflow_products').insert(payload).select().single()
        if (insertError) throw insertError
        setProducts(prev => [created as PrecyFlowProduct, ...prev])
      }

      setShowForm(false)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erro ao salvar produto.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(product: PrecyFlowProduct) {
    const supabase = createClient()
    const { data: updated, error: updateError } = await supabase
      .from('precyflow_products').update({ is_active: !product.is_active }).eq('id', product.id).select().single()
    if (!updateError) setProducts(prev => prev.map(p => (p.id === product.id ? (updated as PrecyFlowProduct) : p)))
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--pf-text)' }}>Produtos</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pf-text-secondary)' }}>Catálogo do seu negócio</p>
        </div>
        <button onClick={openNew} className="pf-btn-primary">
          <Plus size={16} /> Novo produto
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 flex-1 min-w-[200px]" style={{ border: '1px solid var(--pf-border)', backgroundColor: 'var(--pf-surface)' }}>
          <Search size={16} style={{ color: 'var(--pf-text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou código..."
            className="bg-transparent text-sm outline-none flex-1"
            style={{ color: 'var(--pf-text)' }}
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="pf-input w-auto">
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      <div className="pf-card !p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum produto encontrado"
            description="Cadastre seu primeiro produto para começar a vender."
            action={<button onClick={openNew} className="pf-btn-primary"><Plus size={16} /> Novo produto</button>}
          />
        ) : (
          <div className="table-responsive">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--pf-border)' }}>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Produto</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Categoria</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Estoque</th>
                  <th className="text-right font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Preço</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(product => (
                  <tr key={product.id} style={{ borderTop: '1px solid var(--pf-border)' }}>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: 'var(--pf-text)' }}>{product.name}</div>
                      {product.sku && <div className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>{product.sku}</div>}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>{product.category}</td>
                    <td className="px-4 py-3" style={{ color: product.stock_quantity <= product.minimum_quantity ? 'var(--pf-warning)' : 'var(--pf-text-secondary)' }}>
                      {product.stock_quantity}
                    </td>
                    <td className="px-4 py-3 text-right font-medium" style={{ color: 'var(--pf-text)' }}>{formatBRL(product.price)}</td>
                    <td className="px-4 py-3">
                      <span className={`pf-badge ${product.is_active ? 'pf-badge-success' : 'pf-badge-muted'}`}>
                        {product.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => openEdit(product)} aria-label="Editar" style={{ color: 'var(--pf-text-secondary)' }}><Pencil size={16} /></button>
                        <button onClick={() => toggleActive(product)} aria-label={product.is_active ? 'Arquivar' : 'Reativar'} style={{ color: 'var(--pf-text-secondary)' }}>
                          {product.is_active ? <Archive size={16} /> : <ArchiveRestore size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <Modal title={editing ? 'Editar produto' : 'Novo produto'} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Nome</label>
              <input className="pf-input" {...register('name')} />
              {errors.name && <p className="mt-1 text-xs" style={{ color: 'var(--pf-error)' }}>{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Categoria</label>
                <input className="pf-input" {...register('category')} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Código/SKU</label>
                <input className="pf-input" {...register('sku')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Preço de venda (R$)</label>
                <input type="number" step="0.01" className="pf-input" {...register('price')} />
                {errors.price && <p className="mt-1 text-xs" style={{ color: 'var(--pf-error)' }}>{errors.price.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Estoque</label>
                <input type="number" step="1" className="pf-input" {...register('stock_quantity')} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Estoque mínimo (alerta)</label>
              <input type="number" step="1" className="pf-input" {...register('minimum_quantity')} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Descrição</label>
              <textarea className="pf-input" rows={3} {...register('description')} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>URL da foto (opcional)</label>
              <input className="pf-input" placeholder="https://..." {...register('image_url')} />
            </div>

            {error && (
              <div className="text-sm px-4 py-3 rounded-xl" style={{ backgroundColor: 'var(--pf-error-bg)', color: 'var(--pf-error)' }}>{error}</div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="pf-btn-ghost flex-1">Cancelar</button>
              <button type="submit" disabled={saving} className="pf-btn-primary flex-1">
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
