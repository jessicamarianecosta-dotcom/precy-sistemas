'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Boxes, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePrecyflowCompany } from '@/hooks/usePrecyflowCompany'
import { formatCurrency } from '@/lib/utils/format'
import { PrecyflowHeader } from '@/components/precyflow/Header'
import { PrecyflowModal } from '@/components/precyflow/Modal'
import { PrecyflowEmptyState } from '@/components/precyflow/EmptyState'

interface Material {
  id: string
  name: string
  category: string | null
  unit: string
  quantity: number
  minimum_quantity: number
  cost_per_unit: number
  supplier: string | null
  status: string | null
}

function useMaterials(companyId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['precyflow-materiais', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory')
        .select('id, name, category, unit, quantity, minimum_quantity, cost_per_unit, supplier, status')
        .eq('company_id', companyId as string)
        .order('name', { ascending: true }) as any
      if (error) throw error
      return (data ?? []) as Material[]
    },
  })
}

const emptyForm = { name: '', category: '', unit: 'un', quantity: '', minimum_quantity: '', cost_per_unit: '', supplier: '' }

export default function PrecyflowMateriaisPage() {
  const { companyId, companyName } = usePrecyflowCompany()
  const { data: materials, isLoading } = useMaterials(companyId)
  const queryClient = useQueryClient()
  const supabase = createClient()

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Material | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = (materials ?? []).filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase())
  )
  const lowStock = (materials ?? []).filter(m => m.quantity <= m.minimum_quantity)

  function openCreate() {
    setEditing(null); setForm(emptyForm); setError(null); setShowForm(true)
  }
  function openEdit(m: Material) {
    setEditing(m)
    setForm({
      name: m.name, category: m.category ?? '', unit: m.unit,
      quantity: String(m.quantity), minimum_quantity: String(m.minimum_quantity),
      cost_per_unit: String(m.cost_per_unit), supplier: m.supplier ?? '',
    })
    setError(null); setShowForm(true)
  }

  async function handleSave() {
    if (!companyId) return
    if (!form.name.trim()) { setError('Informe o nome do material.'); return }
    const quantity = Number(form.quantity.replace(',', '.'))
    const minimum = Number((form.minimum_quantity || '0').replace(',', '.'))
    const cost = Number((form.cost_per_unit || '0').replace(',', '.'))
    if (Number.isNaN(quantity) || quantity < 0) { setError('Informe uma quantidade válida.'); return }

    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || null,
        unit: form.unit.trim() || 'un',
        quantity, minimum_quantity: Number.isNaN(minimum) ? 0 : minimum,
        cost_per_unit: Number.isNaN(cost) ? 0 : cost,
        supplier: form.supplier.trim() || null,
      }
      if (editing) {
        const { error: err } = await (supabase.from('inventory') as any).update(payload).eq('id', editing.id)
        if (err) throw err
      } else {
        const { error: err } = await (supabase.from('inventory') as any).insert({ ...payload, company_id: companyId })
        if (err) throw err
      }
      await queryClient.invalidateQueries({ queryKey: ['precyflow-materiais', companyId] })
      setShowForm(false)
    } catch {
      setError('Não foi possível salvar o material. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(m: Material) {
    if (!confirm(`Remover "${m.name}" do estoque de materiais?`)) return
    await (supabase.from('inventory') as any).delete().eq('id', m.id)
    queryClient.invalidateQueries({ queryKey: ['precyflow-materiais', companyId] })
  }

  return (
    <div>
      <PrecyflowHeader title="Materiais" subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-4">
        {lowStock.length > 0 && (
          <div className="pf-card p-3 flex items-center gap-2.5 text-sm" style={{ borderColor: 'var(--pf-warning)' }}>
            <AlertTriangle size={16} className="text-warning flex-shrink-0" />
            <span>{lowStock.length} material(is) no estoque mínimo ou abaixo — considere repor.</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--pf-text-muted)' }} />
            <input className="input pl-9" placeholder="Buscar material..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={openCreate} className="pf-btn-primary flex items-center justify-center gap-2 px-4 py-2.5 whitespace-nowrap">
            <Plus size={16} /> Novo material
          </button>
        </div>

        {isLoading ? (
          <div className="pf-card h-64 animate-pulse" />
        ) : filtered.length === 0 ? (
          <div className="pf-card">
            <PrecyflowEmptyState
              icon={Boxes}
              title={materials?.length ? 'Nenhum material encontrado' : 'Nenhum material cadastrado ainda'}
              subtitle={materials?.length ? 'Tente ajustar a busca.' : 'Cadastre os insumos usados na produção.'}
              action={!materials?.length && <button onClick={openCreate} className="pf-btn-primary px-4 py-2">Novo material</button>}
            />
          </div>
        ) : (
          <div className="pf-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: 'var(--pf-border)', color: 'var(--pf-text-secondary)' }}>
                  <th className="px-4 py-3 font-medium">Material</th>
                  <th className="px-4 py-3 font-medium">Fornecedor</th>
                  <th className="px-4 py-3 font-medium">Qtd.</th>
                  <th className="px-4 py-3 font-medium">Custo/un.</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const low = m.quantity <= m.minimum_quantity
                  return (
                    <tr key={m.id} className="border-b last:border-0" style={{ borderColor: 'var(--pf-border)' }}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{m.name}</p>
                        <p className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>{m.category ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3">{m.supplier ?? '—'}</td>
                      <td className="px-4 py-3">{m.quantity} {m.unit}</td>
                      <td className="px-4 py-3">{formatCurrency(Number(m.cost_per_unit))}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${low ? 'bg-warning-light text-warning-dark' : 'bg-success-light text-success-dark'}`}>
                          {low ? 'Repor' : 'Ok'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:pf-bg-primary-soft"><Pencil size={14} /></button>
                          <button onClick={() => handleDelete(m)} className="p-1.5 rounded-lg hover:pf-bg-primary-soft text-error"><Trash2 size={14} /></button>
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
        <PrecyflowModal title={editing ? 'Editar material' : 'Novo material'} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nome</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Fita de cetim 22mm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Categoria</label>
                <input className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Ex: fitas" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Unidade</label>
                <input className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="un, m, kg..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Quantidade disponível</label>
                <input className="input" inputMode="decimal" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Estoque mínimo</label>
                <input className="input" inputMode="decimal" value={form.minimum_quantity} onChange={e => setForm(f => ({ ...f, minimum_quantity: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Custo por unidade (R$)</label>
                <input className="input" inputMode="decimal" value={form.cost_per_unit} onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Fornecedor</label>
                <input className="input" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            {error && <div className="bg-error-light text-error-dark text-sm px-4 py-3 rounded-xl">{error}</div>}
            <button onClick={handleSave} disabled={saving} className="pf-btn-primary w-full py-2.5 mt-2">
              {saving ? 'Salvando...' : 'Salvar material'}
            </button>
          </div>
        </PrecyflowModal>
      )}
    </div>
  )
}
