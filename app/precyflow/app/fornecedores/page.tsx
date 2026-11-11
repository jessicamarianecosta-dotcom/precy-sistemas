'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Truck, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePrecyflowCompany } from '@/hooks/usePrecyflowCompany'
import { PrecyflowHeader } from '@/components/precyflow/Header'
import { PrecyflowModal } from '@/components/precyflow/Modal'
import { PrecyflowEmptyState } from '@/components/precyflow/EmptyState'

interface Supplier {
  id: string
  name: string
  phone: string | null
  email: string | null
  category: string | null
  notes: string | null
}

function useSuppliers(companyId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['precyflow-fornecedores', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers')
        .select('id, name, phone, email, category, notes')
        .eq('company_id', companyId as string)
        .order('name') as any
      if (error) throw error
      return (data ?? []) as Supplier[]
    },
  })
}

const emptyForm = { name: '', phone: '', email: '', category: '', notes: '' }

export default function PrecyflowFornecedoresPage() {
  const { companyId, companyName } = usePrecyflowCompany()
  const { data: suppliers, isLoading } = useSuppliers(companyId)
  const queryClient = useQueryClient()
  const supabase = createClient()

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = (suppliers ?? []).filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))

  function openCreate() { setEditing(null); setForm(emptyForm); setError(null); setShowForm(true) }
  function openEdit(s: Supplier) {
    setEditing(s)
    setForm({ name: s.name, phone: s.phone ?? '', email: s.email ?? '', category: s.category ?? '', notes: s.notes ?? '' })
    setError(null); setShowForm(true)
  }

  async function handleSave() {
    if (!companyId) return
    if (!form.name.trim()) { setError('Informe o nome do fornecedor.'); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        category: form.category.trim() || null,
        notes: form.notes.trim() || null,
      }
      if (editing) {
        const { error: err } = await (supabase.from('suppliers') as any).update(payload).eq('id', editing.id)
        if (err) throw err
      } else {
        const { error: err } = await (supabase.from('suppliers') as any).insert({ ...payload, company_id: companyId, is_active: true })
        if (err) throw err
      }
      await queryClient.invalidateQueries({ queryKey: ['precyflow-fornecedores', companyId] })
      setShowForm(false)
    } catch {
      setError('Não foi possível salvar o fornecedor. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PrecyflowHeader title="Fornecedores" subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--pf-text-muted)' }} />
            <input className="input pl-9" placeholder="Buscar fornecedor..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={openCreate} className="pf-btn-primary flex items-center justify-center gap-2 px-4 py-2.5 whitespace-nowrap">
            <Plus size={16} /> Novo fornecedor
          </button>
        </div>

        {isLoading ? (
          <div className="pf-card h-48 animate-pulse" />
        ) : filtered.length === 0 ? (
          <div className="pf-card">
            <PrecyflowEmptyState
              icon={Truck}
              title={suppliers?.length ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado ainda'}
              subtitle={suppliers?.length ? 'Tente ajustar a busca.' : 'Cadastre os fornecedores dos seus materiais.'}
              action={!suppliers?.length && <button onClick={openCreate} className="pf-btn-primary px-4 py-2">Novo fornecedor</button>}
            />
          </div>
        ) : (
          <div className="pf-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: 'var(--pf-border)', color: 'var(--pf-text-secondary)' }}>
                  <th className="px-4 py-3 font-medium">Fornecedor</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Contato</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-b last:border-0" style={{ borderColor: 'var(--pf-border)' }}>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>{s.category ?? '—'}</td>
                    <td className="px-4 py-3">{s.phone ?? s.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:pf-bg-primary-soft"><Pencil size={14} /></button>
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
        <PrecyflowModal title={editing ? 'Editar fornecedor' : 'Novo fornecedor'} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nome</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do fornecedor" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Telefone</label>
                <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">E-mail</label>
                <input className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Categoria de fornecimento</label>
              <input className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Ex: fitas, embalagens..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Observações</label>
              <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            {error && <div className="bg-error-light text-error-dark text-sm px-4 py-3 rounded-xl">{error}</div>}
            <button onClick={handleSave} disabled={saving} className="pf-btn-primary w-full py-2.5 mt-2">
              {saving ? 'Salvando...' : 'Salvar fornecedor'}
            </button>
          </div>
        </PrecyflowModal>
      )}
    </div>
  )
}
