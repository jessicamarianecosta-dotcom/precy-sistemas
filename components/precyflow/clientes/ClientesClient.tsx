'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Users, Plus, Search, Pencil, Trash2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/precyflow/supabase'
import { EmptyState } from '@/components/precyflow/EmptyState'
import { Modal } from '@/components/precyflow/Modal'
import type { PrecyFlowCustomer } from '@/lib/precyflow/types'

const schema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export function ClientesClient({ storeId, initialCustomers }: { storeId: string; initialCustomers: PrecyFlowCustomer[] }) {
  const [customers, setCustomers] = useState(initialCustomers)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<PrecyFlowCustomer | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(
    () => customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? '').includes(search)),
    [customers, search]
  )

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  function openNew() {
    setEditing(null)
    reset({ name: '', phone: '', email: '', notes: '' })
    setShowForm(true)
  }

  function openEdit(customer: PrecyFlowCustomer) {
    setEditing(customer)
    reset({ name: customer.name, phone: customer.phone ?? '', email: customer.email ?? '', notes: customer.notes ?? '' })
    setShowForm(true)
  }

  async function onSubmit(data: FormData) {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const payload = { store_id: storeId, name: data.name, phone: data.phone || null, email: data.email || null, notes: data.notes || null }

      if (editing) {
        const { data: updated, error: updateError } = await supabase
          .from('precyflow_customers').update(payload).eq('id', editing.id).select().single()
        if (updateError) throw updateError
        setCustomers(prev => prev.map(c => (c.id === editing.id ? (updated as PrecyFlowCustomer) : c)))
      } else {
        const { data: created, error: insertError } = await supabase
          .from('precyflow_customers').insert(payload).select().single()
        if (insertError) throw insertError
        setCustomers(prev => [created as PrecyFlowCustomer, ...prev])
      }

      setShowForm(false)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erro ao salvar cliente.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(customer: PrecyFlowCustomer) {
    if (!confirm(`Remover "${customer.name}"? Pedidos e orçamentos já criados não serão afetados.`)) return
    const supabase = createClient()
    const { error: deleteError } = await supabase.from('precyflow_customers').delete().eq('id', customer.id)
    if (!deleteError) setCustomers(prev => prev.filter(c => c.id !== customer.id))
    else alert('Não é possível remover: este cliente tem pedidos ou orçamentos vinculados.')
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--pf-text)' }}>Clientes</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pf-text-secondary)' }}>Cadastro e histórico de clientes</p>
        </div>
        <button onClick={openNew} className="pf-btn-primary"><Plus size={16} /> Novo cliente</button>
      </div>

      <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-4 max-w-sm" style={{ border: '1px solid var(--pf-border)', backgroundColor: 'var(--pf-surface)' }}>
        <Search size={16} style={{ color: 'var(--pf-text-muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou telefone..." className="bg-transparent text-sm outline-none flex-1" style={{ color: 'var(--pf-text)' }} />
      </div>

      <div className="pf-card !p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum cliente cadastrado" description="Cadastre seus clientes para criar pedidos e orçamentos." action={<button onClick={openNew} className="pf-btn-primary"><Plus size={16} /> Novo cliente</button>} />
        ) : (
          <div className="table-responsive">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--pf-border)' }}>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Nome</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Telefone</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>E-mail</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(customer => (
                  <tr key={customer.id} style={{ borderTop: '1px solid var(--pf-border)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--pf-text)' }}>{customer.name}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>{customer.phone ?? '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>{customer.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => openEdit(customer)} aria-label="Editar" style={{ color: 'var(--pf-text-secondary)' }}><Pencil size={16} /></button>
                        <button onClick={() => handleDelete(customer)} aria-label="Remover" style={{ color: 'var(--pf-text-secondary)' }}><Trash2 size={16} /></button>
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
        <Modal title={editing ? 'Editar cliente' : 'Novo cliente'} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Nome</label>
              <input className="pf-input" {...register('name')} />
              {errors.name && <p className="mt-1 text-xs" style={{ color: 'var(--pf-error)' }}>{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Telefone</label>
                <input className="pf-input" placeholder="(11) 99999-9999" {...register('phone')} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>E-mail</label>
                <input type="email" className="pf-input" {...register('email')} />
                {errors.email && <p className="mt-1 text-xs" style={{ color: 'var(--pf-error)' }}>{errors.email.message}</p>}
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
