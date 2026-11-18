'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Boxes, Plus, Search, Pencil, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/precyflow/supabase'
import { formatBRL } from '@/lib/precyflow/format'
import { EmptyState } from '@/components/precyflow/EmptyState'
import { Modal } from '@/components/precyflow/Modal'
import type { PrecyFlowMaterial, PrecyFlowSupplier } from '@/lib/precyflow/types'

const schema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  unit: z.string().min(1, 'Informe a unidade'),
  cost_per_unit: z.coerce.number().min(0),
  quantity: z.coerce.number().min(0),
  minimum_quantity: z.coerce.number().min(0),
  supplier_id: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export function MateriaisClient({
  storeId,
  initialMaterials,
  suppliers,
}: {
  storeId: string
  initialMaterials: PrecyFlowMaterial[]
  suppliers: PrecyFlowSupplier[]
}) {
  const [materials, setMaterials] = useState(initialMaterials)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<PrecyFlowMaterial | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(
    () => materials.filter(m => m.name.toLowerCase().includes(search.toLowerCase())),
    [materials, search]
  )

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  function openNew() {
    setEditing(null)
    reset({ name: '', unit: 'un', cost_per_unit: 0, quantity: 0, minimum_quantity: 0, supplier_id: '' })
    setShowForm(true)
  }

  function openEdit(material: PrecyFlowMaterial) {
    setEditing(material)
    reset({
      name: material.name,
      unit: material.unit,
      cost_per_unit: material.cost_per_unit,
      quantity: material.quantity,
      minimum_quantity: material.minimum_quantity,
      supplier_id: material.supplier_id ?? '',
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
        unit: data.unit,
        cost_per_unit: data.cost_per_unit,
        quantity: data.quantity,
        minimum_quantity: data.minimum_quantity,
        supplier_id: data.supplier_id || null,
      }

      if (editing) {
        const { data: updated, error: updateError } = await supabase
          .from('precyflow_materials').update(payload).eq('id', editing.id).select().single()
        if (updateError) throw updateError
        setMaterials(prev => prev.map(m => (m.id === editing.id ? (updated as PrecyFlowMaterial) : m)))
      } else {
        const { data: created, error: insertError } = await supabase
          .from('precyflow_materials').insert(payload).select().single()
        if (insertError) throw insertError
        setMaterials(prev => [created as PrecyFlowMaterial, ...prev])
      }

      setShowForm(false)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erro ao salvar material.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(material: PrecyFlowMaterial) {
    if (!confirm(`Remover "${material.name}"?`)) return
    const supabase = createClient()
    const { error: deleteError } = await supabase.from('precyflow_materials').delete().eq('id', material.id)
    if (!deleteError) setMaterials(prev => prev.filter(m => m.id !== material.id))
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--pf-text)' }}>Materiais</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pf-text-secondary)' }}>Insumos usados na produção</p>
        </div>
        <button onClick={openNew} className="pf-btn-primary"><Plus size={16} /> Novo material</button>
      </div>

      <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-4 max-w-sm" style={{ border: '1px solid var(--pf-border)', backgroundColor: 'var(--pf-surface)' }}>
        <Search size={16} style={{ color: 'var(--pf-text-muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar material..." className="bg-transparent text-sm outline-none flex-1" style={{ color: 'var(--pf-text)' }} />
      </div>

      <div className="pf-card !p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Boxes} title="Nenhum material cadastrado" description="Cadastre os insumos que você usa na produção." action={<button onClick={openNew} className="pf-btn-primary"><Plus size={16} /> Novo material</button>} />
        ) : (
          <div className="table-responsive">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--pf-border)' }}>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Material</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Quantidade</th>
                  <th className="text-right font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Custo/un.</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Fornecedor</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(material => {
                  const low = material.quantity <= material.minimum_quantity
                  const supplier = suppliers.find(s => s.id === material.supplier_id)
                  return (
                    <tr key={material.id} style={{ borderTop: '1px solid var(--pf-border)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--pf-text)' }}>{material.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5" style={{ color: low ? 'var(--pf-warning)' : 'var(--pf-text-secondary)' }}>
                          {low && <AlertTriangle size={14} />}
                          {material.quantity} {material.unit}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: 'var(--pf-text-secondary)' }}>{formatBRL(material.cost_per_unit)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>{supplier?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openEdit(material)} aria-label="Editar" style={{ color: 'var(--pf-text-secondary)' }}><Pencil size={16} /></button>
                          <button onClick={() => handleDelete(material)} aria-label="Remover" style={{ color: 'var(--pf-text-secondary)' }}><Trash2 size={16} /></button>
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
        <Modal title={editing ? 'Editar material' : 'Novo material'} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Nome</label>
              <input className="pf-input" {...register('name')} />
              {errors.name && <p className="mt-1 text-xs" style={{ color: 'var(--pf-error)' }}>{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Unidade</label>
                <input className="pf-input" placeholder="un, m, kg..." {...register('unit')} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Custo por unidade (R$)</label>
                <input type="number" step="0.01" className="pf-input" {...register('cost_per_unit')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Quantidade</label>
                <input type="number" step="0.01" className="pf-input" {...register('quantity')} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Alerta de reposição</label>
                <input type="number" step="0.01" className="pf-input" {...register('minimum_quantity')} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Fornecedor</label>
              <select className="pf-input" {...register('supplier_id')}>
                <option value="">Sem fornecedor</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
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
