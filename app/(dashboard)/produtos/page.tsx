'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toaster'
import { useCompanyId } from '@/hooks/useCompanyId'
import { Package, Plus, Search, Edit2, Trash2, X, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { clsx } from 'clsx'

/* ─── Schema ─── */
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

/* ─── Helper ─── */
function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

/* ─── Page ─── */
export default function ProdutosPage() {
  const supabase    = createClient()
  const qc          = useQueryClient()
  const { toast }   = useToast()
  const { companyId } = useCompanyId()

  const [showModal,  setShowModal]  = useState(false)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [search,     setSearch]     = useState('')
  const [deleteId,   setDeleteId]   = useState<string | null>(null)

  /* ── Query ── */
  const { data: products, isLoading } = useQuery({
    queryKey: ['products', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data, error } = await (supabase.from('products') as any)
        .select('*').eq('company_id', companyId!).order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  /* ── Form ── */
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { unit: 'un', markup_percentage: 100, production_time_hours: 1, material_cost: 0, final_price: 0 },
  })

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
      closeModal()
    },
    onError: (err: Error) => {
      console.error('[produtos] save error:', err)
      toast('error', `Erro ao salvar: ${err.message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('products') as any).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products', companyId] })
      toast('success', 'Produto removido.')
      setDeleteId(null)
    },
    onError: (err: Error) => {
      console.error('[produtos] delete error:', err)
      toast('error', `Erro ao excluir: ${err.message}`)
    },
  })

  /* ── Handlers ── */
  function openEdit(p: Record<string, unknown>) {
    setEditingId(p.id as string)
    ;(['name','description','category','unit','production_time_hours','material_cost','markup_percentage','final_price'] as Array<keyof FormData>)
      .forEach(k => setValue(k, p[k] as string))
    setShowModal(true)
  }
  function closeModal() { setShowModal(false); reset(); setEditingId(null) }

  const filtered = (products ?? []).filter((p: Record<string, unknown>) =>
    (p.name as string).toLowerCase().includes(search.toLowerCase()) ||
    (p.category as string).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page-enter">
      <Header title="Produtos" subtitle="Gerencie seu catálogo de produtos" />
      <div className="p-4 sm:p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="text" placeholder="Buscar produtos..." className="input pl-9"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => { reset(); setEditingId(null); setShowModal(true) }}
            className="btn-primary flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
            <Plus size={16} /> Novo Produto
          </button>
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-6"><SkeletonTable rows={5} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Package} title="Nenhum produto cadastrado"
              description="Cadastre seus produtos para usar em pedidos e orçamentos."
              action={{ label: '+ Novo Produto', onClick: () => setShowModal(true) }} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border dark:border-border-dark">
                    {['Produto', 'Categoria', 'Custo', 'Margem', 'Preço Final', 'Ações'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider p-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p: Record<string, unknown>) => (
                    <tr key={p.id as string} className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/30 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Package size={15} className="text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary dark:text-stone-100">{p.name as string}</p>
                            <p className="text-xs text-text-muted">{p.unit as string} · {p.production_time_hours as number}h</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4"><span className="badge badge-primary">{p.category as string}</span></td>
                      <td className="p-4 text-sm text-text-secondary dark:text-stone-300">{fmt(p.material_cost as number)}</td>
                      <td className="p-4 text-sm text-text-secondary dark:text-stone-300">{p.markup_percentage as number}%</td>
                      <td className="p-4"><span className="text-sm font-bold text-primary">{fmt(p.final_price as number)}</span></td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => setDeleteId(p.id as string)} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Criar/Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-lg animate-scaleIn max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-surface-dark p-6 pb-4 border-b border-border dark:border-border-dark rounded-t-2xl z-10 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary dark:text-stone-100">{editingId ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Nome *</label>
                  <input className="input" placeholder="Ex: Copo personalizado" {...register('name')} />
                  {errors.name && <p className="mt-1 text-xs text-error">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Categoria *</label>
                  <input className="input" placeholder="Ex: Canecas" {...register('category')} />
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
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saveMutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saveMutation.isPending && <Loader2 size={15} className="animate-spin" />}
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Delete */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm animate-scaleIn p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-error-light flex items-center justify-center mx-auto mb-4"><Trash2 size={20} className="text-error" /></div>
            <h3 className="text-base font-semibold text-text-primary dark:text-stone-100 mb-2">Excluir produto?</h3>
            <p className="text-sm text-text-secondary dark:text-stone-400 mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => deleteMutation.mutate(deleteId!)} disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-error hover:opacity-90 transition-all disabled:opacity-50">
                {deleteMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
