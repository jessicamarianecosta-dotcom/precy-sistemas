'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Users, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePrecyflowCompany } from '@/hooks/usePrecyflowCompany'
import { PrecyflowHeader } from '@/components/precyflow/Header'
import { PrecyflowModal } from '@/components/precyflow/Modal'
import { PrecyflowEmptyState } from '@/components/precyflow/EmptyState'

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
}

function useCustomers(companyId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['precyflow-clientes', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from('customers')
        .select('id, name, email, phone, notes')
        .eq('company_id', companyId as string)
        .order('name', { ascending: true }) as any
      if (error) throw error
      return (data ?? []) as Customer[]
    },
  })
}

const emptyForm = { name: '', email: '', phone: '', notes: '' }

export default function PrecyflowClientesPage() {
  const { companyId, companyName } = usePrecyflowCompany()
  const { data: customers, isLoading } = useCustomers(companyId)
  const queryClient = useQueryClient()
  const supabase = createClient()

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = (customers ?? []).filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? '').includes(search)
  )

  function openCreate() { setEditing(null); setForm(emptyForm); setError(null); setShowForm(true) }
  function openEdit(c: Customer) {
    setEditing(c)
    setForm({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', notes: c.notes ?? '' })
    setError(null); setShowForm(true)
  }

  async function handleSave() {
    if (!companyId) return
    if (!form.name.trim()) { setError('Informe o nome do cliente.'); return }

    // Evita duplicidade evidente: mesmo nome já cadastrado.
    const duplicate = (customers ?? []).some(c =>
      c.id !== editing?.id && c.name.trim().toLowerCase() === form.name.trim().toLowerCase()
    )
    if (duplicate && !confirm('Já existe um cliente com esse nome. Cadastrar mesmo assim?')) return

    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      }
      if (editing) {
        const { error: err } = await (supabase.from('customers') as any).update(payload).eq('id', editing.id)
        if (err) throw err
      } else {
        const { error: err } = await (supabase.from('customers') as any).insert({ ...payload, company_id: companyId })
        if (err) throw err
      }
      await queryClient.invalidateQueries({ queryKey: ['precyflow-clientes', companyId] })
      setShowForm(false)
    } catch {
      setError('Não foi possível salvar o cliente. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PrecyflowHeader title="Clientes" subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--pf-text-muted)' }} />
            <input className="input pl-9" placeholder="Buscar por nome ou telefone..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={openCreate} className="pf-btn-primary flex items-center justify-center gap-2 px-4 py-2.5 whitespace-nowrap">
            <Plus size={16} /> Novo cliente
          </button>
        </div>

        {isLoading ? (
          <div className="pf-card h-64 animate-pulse" />
        ) : filtered.length === 0 ? (
          <div className="pf-card">
            <PrecyflowEmptyState
              icon={Users}
              title={customers?.length ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
              subtitle={customers?.length ? 'Tente ajustar a busca.' : 'Cadastre seus clientes para vincular pedidos e orçamentos.'}
              action={!customers?.length && <button onClick={openCreate} className="pf-btn-primary px-4 py-2">Novo cliente</button>}
            />
          </div>
        ) : (
          <div className="pf-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: 'var(--pf-border)', color: 'var(--pf-text-secondary)' }}>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Contato</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b last:border-0" style={{ borderColor: 'var(--pf-border)' }}>
                    <td className="px-4 py-3">
                      <Link href={`/precyflow/app/clientes/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>{c.phone ?? c.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:pf-bg-primary-soft"><Pencil size={14} /></button>
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
        <PrecyflowModal title={editing ? 'Editar cliente' : 'Novo cliente'} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nome</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Telefone</label>
                <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(11) 90000-0000" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">E-mail</label>
                <input className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Observações</label>
              <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            {error && <div className="bg-error-light text-error-dark text-sm px-4 py-3 rounded-xl">{error}</div>}
            <button onClick={handleSave} disabled={saving} className="pf-btn-primary w-full py-2.5 mt-2">
              {saving ? 'Salvando...' : 'Salvar cliente'}
            </button>
          </div>
        </PrecyflowModal>
      )}
    </div>
  )
}
