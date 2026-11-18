'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Truck, Plus, Search, Pencil, Trash2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/precyflow/supabase'
import { EmptyState } from '@/components/precyflow/EmptyState'
import { Modal } from '@/components/precyflow/Modal'
import type { PrecyFlowMaterial, PrecyFlowSupplier } from '@/lib/precyflow/types'

const schema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  contact: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export function FornecedoresClient({
  storeId,
  initialSuppliers,
  materials,
}: {
  storeId: string
  initialSuppliers: PrecyFlowSupplier[]
  materials: PrecyFlowMaterial[]
}) {
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<PrecyFlowSupplier | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase())), [suppliers, search])

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  function openNew() {
    setEditing(null)
    reset({ name: '', contact: '', category: '', notes: '' })
    setShowForm(true)
  }

  function openEdit(supplier: PrecyFlowSupplier) {
    setEditing(supplier)
    reset({ name: supplier.name, contact: supplier.contact ?? '', category: supplier.category ?? '', notes: supplier.notes ?? '' })
    setShowForm(true)
  }

  async function onSubmit(data: FormData) {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const payload = { store_id: storeId, name: data.name, contact: data.contact || null, category: data.category || null, notes: data.notes || null }

      if (editing) {
        const { data: updated, error: updateError } = await supabase
          .from('precyflow_suppliers').update(payload).eq('id', editing.id).select().single()
        if (updateError) throw updateError
        setSuppliers(prev => prev.map(s => (s.id === editing.id ? (updated as PrecyFlowSupplier) : s)))
      } else {
        const { data: created, error: insertError } = await supabase
          .from('precyflow_suppliers').insert(payload).select().single()
        if (insertError) throw insertError
        setSuppliers(prev => [created as PrecyFlowSupplier, ...prev])
      }

      setShowForm(false)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erro ao salvar fornecedor.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(supplier: PrecyFlowSupplier) {
    if (!confirm(`Remover "${supplier.name}"?`)) return
    const supabase = createClient()
    const { error: deleteError } = await supabase.from('precyflow_suppliers').delete().eq('id', supplier.id)
    if (!deleteError) setSuppliers(prev => prev.filter(s => s.id !== supplier.id))
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--pf-text)' }}>Fornecedores</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pf-text-secondary)' }}>Quem fornece seus materiais</p>
        </div>
        <button onClick={openNew} className="pf-btn-primary"><Plus size={16} /> Novo fornecedor</button>
      </div>

      <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-4 max-w-sm" style={{ border: '1px solid var(--pf-border)', backgroundColor: 'var(--pf-surface)' }}>
        <Search size={16} style={{ color: 'var(--pf-text-muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar fornecedor..." className="bg-transparent text-sm outline-none flex-1" style={{ color: 'var(--pf-text)' }} />
      </div>

      <div className="pf-card !p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Truck} title="Nenhum fornecedor cadastrado" description="Cadastre fornecedores e vincule materiais a eles." action={<button onClick={openNew} className="pf-btn-primary"><Plus size={16} /> Novo fornecedor</button>} />
        ) : (
          <div className="table-responsive">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--pf-border)' }}>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Fornecedor</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Contato</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Categoria</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Materiais</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(supplier => {
                  const count = materials.filter(m => m.supplier_id === supplier.id).length
                  return (
                    <tr key={supplier.id} style={{ borderTop: '1px solid var(--pf-border)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--pf-text)' }}>{supplier.name}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>{supplier.contact ?? '—'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>{supplier.category ?? '—'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>{count}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openEdit(supplier)} aria-label="Editar" style={{ color: 'var(--pf-text-secondary)' }}><Pencil size={16} /></button>
                          <button onClick={() => handleDelete(supplier)} aria-label="Remover" style={{ color: 'var(--pf-text-secondary)' }}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <Modal title={editing ? 'Editar fornecedor' : 'Novo fornecedor'} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Nome</label>
              <input className="pf-input" {...register('name')} />
              {errors.name && <p className="mt-1 text-xs" style={{ color: 'var(--pf-error)' }}>{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Contato</label>
                <input className="pf-input" {...register('contact')} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Categoria</label>
                <input className="pf-input" placeholder="Fitas, embalagens..." {...register('category')} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Observações</label>
              <textarea className="pf-input" rows={3} {...register('notes')} />
            </div>

            {error && <div className="text-sm px-4 py-3 rounded-xl" style={{ backgroundColor: 'var(--pf-error-bg)', color: 'var(--pf-error)' }}>{error}</div>}

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
