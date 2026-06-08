'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Users, Plus, Search, Edit2, Trash2, X, Loader2, Phone, Mail } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function ClientesPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: company } = await supabase.from('companies').select('id').eq('user_id', user.id).single()
      if (company) setCompanyId(company.id)
    }
    load()
  }, [])

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from('customers').select('*').eq('company_id', companyId!)
        .order('name', { ascending: true })
      return data ?? []
    },
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (editingId) {
        await supabase.from('customers').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingId)
      } else {
        await supabase.from('customers').insert({ ...data, company_id: companyId! })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', companyId] })
      setShowModal(false); reset(); setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from('customers').delete().eq('id', id) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers', companyId] }),
  })

  function openEdit(c: Record<string, unknown>) {
    setEditingId(c.id as string)
    Object.entries(c).forEach(([k, v]) => setValue(k as keyof FormData, v as string))
    setShowModal(true)
  }

  const filtered = customers?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  ) ?? []

  return (
    <div className="page-enter">
      <Header title="Clientes" subtitle={`${customers?.length ?? 0} clientes cadastrados`} />
      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="text" placeholder="Buscar clientes..." className="input pl-9 w-64" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => { reset(); setEditingId(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Novo Cliente
          </button>
        </div>

        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-6"><SkeletonTable rows={5} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum cliente cadastrado"
              description="Cadastre seus clientes para usar em pedidos e orçamentos."
              action={{ label: '+ Novo Cliente', onClick: () => setShowModal(true) }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border dark:border-border-dark">
                    {['Cliente', 'Contato', 'Cidade', 'Total Compras', 'Ações'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider p-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/30 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary/15 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-semibold text-sm">{c.name.slice(0, 2).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary dark:text-stone-100">{c.name}</p>
                            {c.cpf_cnpj && <p className="text-xs text-text-muted">{c.cpf_cnpj}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-0.5">
                          {c.email && <div className="flex items-center gap-1.5 text-xs text-text-secondary dark:text-stone-400"><Mail size={11} />{c.email}</div>}
                          {c.phone && <div className="flex items-center gap-1.5 text-xs text-text-secondary dark:text-stone-400"><Phone size={11} />{c.phone}</div>}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-text-secondary dark:text-stone-300">
                        {c.city ? `${c.city}${c.state ? `, ${c.state}` : ''}` : '—'}
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-semibold text-primary">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.total_purchases ?? 0)}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => deleteMutation.mutate(c.id)} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"><Trash2 size={14} /></button>
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-lg animate-scaleIn max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-surface-dark p-6 pb-4 border-b border-border dark:border-border-dark rounded-t-2xl z-10 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary dark:text-stone-100">{editingId ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-primary-50 text-text-muted"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Nome *</label>
                  <input className="input" placeholder="Nome completo" {...register('name')} />
                  {errors.name && <p className="mt-1 text-xs text-error">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">E-mail</label>
                  <input type="email" className="input" placeholder="email@exemplo.com" {...register('email')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Telefone</label>
                  <input className="input" placeholder="(11) 99999-9999" {...register('phone')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Cidade</label>
                  <input className="input" placeholder="São Paulo" {...register('city')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Estado</label>
                  <input className="input" placeholder="SP" maxLength={2} {...register('state')} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">CPF / CNPJ</label>
                  <input className="input" placeholder="000.000.000-00" {...register('cpf_cnpj')} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Observações</label>
                  <textarea rows={2} className="input resize-none" placeholder="Observações..." {...register('notes')} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saveMutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saveMutation.isPending && <Loader2 size={15} className="animate-spin" />}
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
