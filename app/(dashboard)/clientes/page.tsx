'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { useCompanyId } from '@/hooks/useCompanyId'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Users, Plus, Search, Edit2, Trash2, X, Loader2,
  Phone, Mail, MapPin, TrendingUp, ShoppingBag,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/* ─── Tipos ─── */
interface Customer {
  id:             string
  company_id:     string
  name:           string
  email:          string | null
  phone:          string | null
  address:        string | null
  city:           string | null
  state:          string | null
  cpf_cnpj:       string | null
  notes:          string | null
  total_purchases: number
  created_at:     string
  updated_at:     string
}

/* ─── Schema ─── */
const customerSchema = z.object({
  name:     z.string().min(2, 'Nome obrigatório'),
  email:    z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone:    z.string().optional(),
  city:     z.string().optional(),
  state:    z.string().optional(),
  cpf_cnpj: z.string().optional(),
  notes:    z.string().optional(),
})
type CustomerForm = z.infer<typeof customerSchema>

/* ─── Helpers ─── */
function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}
function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}
const AVATAR_COLORS = [
  'bg-primary-100 dark:bg-primary/20 text-primary',
  'bg-info-light dark:bg-info/20 text-info-dark',
  'bg-success-light dark:bg-success/20 text-success-dark',
  'bg-warning-light dark:bg-warning/20 text-warning-dark',
]
function avatarColor(id: string) {
  const sum = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

/* ─── Componente de campo ─── */
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  )
}

/* ═══════════════════════════════════════ PAGE ═══ */
export default function ClientesPage() {
  const supabase    = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { companyId } = useCompanyId()
  const [showModal,  setShowModal]  = useState(false)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [search,     setSearch]     = useState('')
  const [deleteId,   setDeleteId]   = useState<string | null>(null)

  /* ── Carregar empresa ── */

  /* ── Query clientes ── */
  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ['customers', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
      return (data as Customer[]) ?? []
    },
  })

  /* ── Form ── */
  const {
    register, handleSubmit, reset, setValue,
    formState: { errors },
  } = useForm<CustomerForm>({ resolver: zodResolver(customerSchema) })

  /* ── Mutations ── */
  const saveMutation = useMutation({
    mutationFn: async (d: CustomerForm) => {
      if (editingId) {
        await (supabase.from('customers') as any)
          .update({ ...d, updated_at: new Date().toISOString() })
          .eq('id', editingId)
      } else {
        await (supabase.from('customers') as any)
          .insert([{ ...d, company_id: companyId!, total_purchases: 0 }]).select()
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', companyId] })
      closeModal()
    },
    onError: (err: Error) => {
      console.error('[module] error:', err)
      toast('error', `Erro: ${err.message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await (supabase.from('customers') as any).delete().eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', companyId] })
      setDeleteId(null)
    },
    onError: (err: Error) => {
      console.error('[module] error:', err)
      toast('error', `Erro: ${err.message}`)
    },
  })

  /* ── Handlers ── */
  function openNew() {
    reset()
    setEditingId(null)
    setShowModal(true)
  }

  function openEdit(c: Customer) {
    setEditingId(c.id)
    reset({
      name:     c.name,
      email:    c.email    ?? '',
      phone:    c.phone    ?? '',
      city:     c.city     ?? '',
      state:    c.state    ?? '',
      cpf_cnpj: c.cpf_cnpj ?? '',
      notes:    c.notes    ?? '',
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    reset()
    setEditingId(null)
  }

  /* ── Filtros ── */
  const filtered = (customers ?? []).filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.city?.toLowerCase().includes(search.toLowerCase())
  )

  /* ── Estatísticas ── */
  const totalRevenue = (customers ?? []).reduce((s, c) => s + Number(c.total_purchases), 0)
  const topCustomer  = (customers ?? []).sort((a, b) => b.total_purchases - a.total_purchases)[0]

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div className="page-enter">
      <Header
        title="Clientes"
        subtitle={`${customers?.length ?? 0} cliente${customers?.length !== 1 ? 's' : ''} cadastrado${customers?.length !== 1 ? 's' : ''}`}
      />

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              icon: Users,
              label: 'Total de Clientes',
              value: String(customers?.length ?? 0),
              color: 'text-primary',
              bg:    'bg-primary-50 dark:bg-primary/10',
            },
            {
              icon: TrendingUp,
              label: 'Receita Total',
              value: fmt(totalRevenue),
              color: 'text-success',
              bg:    'bg-success-light dark:bg-success/10',
            },
            {
              icon: ShoppingBag,
              label: 'Maior Comprador',
              value: topCustomer ? topCustomer.name.split(' ')[0] : '—',
              color: 'text-warning',
              bg:    'bg-warning-light dark:bg-warning/10',
            },
          ].map(card => {
            const Icon = card.icon
            return (
              <div key={card.label} className="card flex items-center gap-3.5 p-4">
                <div className={clsx('p-2.5 rounded-xl flex-shrink-0', card.bg)}>
                  <Icon size={18} className={card.color} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-muted dark:text-stone-400 uppercase tracking-wider">
                    {card.label}
                  </p>
                  <p className={clsx('text-lg font-bold truncate', card.color)}>{card.value}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Toolbar ── */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Buscar por nome, e-mail, telefone..."
              className="input pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={openNew}
            className="btn-primary flex items-center gap-2 flex-shrink-0 w-full sm:w-auto"
          >
            <Plus size={16} />
            Novo Cliente
          </button>
        </div>

        {/* ── Lista / tabela ── */}
        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-6">
              <SkeletonTable rows={5} />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title={
                search
                  ? 'Nenhum cliente encontrado'
                  : 'Nenhum cliente cadastrado'
              }
              description={
                search
                  ? `Não encontramos resultados para "${search}".`
                  : 'Cadastre seus clientes para usar em pedidos e orçamentos.'
              }
              action={
                !search
                  ? { label: '+ Cadastrar primeiro cliente', onClick: openNew }
                  : undefined
              }
            />
          ) : (
            <>
              {/* ── MOBILE: cards ── */}
              <div className="md:hidden divide-y divide-border dark:divide-border-dark">
                {filtered.map(c => (
                  <div key={c.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={clsx(
                        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5',
                        avatarColor(c.id)
                      )}>
                        {initials(c.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-primary dark:text-stone-100 truncate">{c.name}</p>
                            {c.cpf_cnpj && <p className="text-[10px] text-text-muted mt-0.5">{c.cpf_cnpj}</p>}
                          </div>
                          {c.total_purchases > 0 && (
                            <span className="text-sm font-bold text-primary flex-shrink-0">
                              {new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c.total_purchases)}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 space-y-1">
                          {c.email && (
                            <div className="flex items-center gap-1.5 text-xs text-text-secondary dark:text-stone-400">
                              <Mail size={11} className="text-text-muted flex-shrink-0" />
                              <span className="truncate">{c.email}</span>
                            </div>
                          )}
                          {c.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-text-secondary dark:text-stone-400">
                              <Phone size={11} className="text-text-muted flex-shrink-0" />
                              <span>{c.phone}</span>
                            </div>
                          )}
                          {(c.city || c.state) && (
                            <div className="flex items-center gap-1.5 text-xs text-text-muted">
                              <MapPin size={11} className="flex-shrink-0" />
                              <span>{[c.city, c.state].filter(Boolean).join(', ')}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <button onClick={() => openEdit(c)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border border-border dark:border-border-dark hover:border-primary hover:text-primary transition-colors">
                            <Edit2 size={12} /> Editar
                          </button>
                          <button onClick={() => setDeleteId(c.id)}
                            className="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── DESKTOP: tabela ── */}
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full">
                <thead>
                  <tr className="border-b border-border dark:border-border-dark">
                    {['Cliente', 'Contato', 'Localização', 'Total Compras', 'Cadastro', 'Ações'].map(h => (
                      <th
                        key={h}
                        className="text-left text-xs font-semibold text-text-muted dark:text-stone-400 uppercase tracking-wider px-4 py-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr
                      key={c.id}
                      className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/30 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Nome + avatar */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold',
                            avatarColor(c.id)
                          )}>
                            {initials(c.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-primary dark:text-stone-100 truncate">
                              {c.name}
                            </p>
                            {c.cpf_cnpj && (
                              <p className="text-[10px] text-text-muted dark:text-stone-500 truncate">
                                {c.cpf_cnpj}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contato */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          {c.email ? (
                            <div className="flex items-center gap-1.5">
                              <Mail size={11} className="text-text-muted flex-shrink-0" />
                              <span className="text-xs text-text-secondary dark:text-stone-300 truncate max-w-[160px]">
                                {c.email}
                              </span>
                            </div>
                          ) : null}
                          {c.phone ? (
                            <div className="flex items-center gap-1.5">
                              <Phone size={11} className="text-text-muted flex-shrink-0" />
                              <span className="text-xs text-text-secondary dark:text-stone-300">
                                {c.phone}
                              </span>
                            </div>
                          ) : null}
                          {!c.email && !c.phone && (
                            <span className="text-xs text-text-muted dark:text-stone-500">—</span>
                          )}
                        </div>
                      </td>

                      {/* Localização */}
                      <td className="px-4 py-3.5">
                        {c.city ? (
                          <div className="flex items-center gap-1.5">
                            <MapPin size={11} className="text-text-muted flex-shrink-0" />
                            <span className="text-xs text-text-secondary dark:text-stone-300">
                              {c.city}{c.state ? `, ${c.state}` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted dark:text-stone-500">—</span>
                        )}
                      </td>

                      {/* Total compras */}
                      <td className="px-4 py-3.5">
                        <span className={clsx(
                          'text-sm font-bold',
                          c.total_purchases > 0 ? 'text-primary' : 'text-text-muted dark:text-stone-500'
                        )}>
                          {fmt(Number(c.total_purchases))}
                        </span>
                      </td>

                      {/* Data */}
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-text-muted dark:text-stone-500">
                          {format(new Date(c.created_at), 'dd/MM/yy', { locale: ptBR })}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEdit(c)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-primary/10 transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteId(c.id)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light dark:hover:bg-error/10 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Footer da tabela */}
              {filtered.length > 0 && (
                <div className="px-4 py-3 border-t border-border dark:border-border-dark flex items-center justify-between">
                  <span className="text-xs text-text-muted dark:text-stone-400">
                    {filtered.length} de {customers?.length} clientes
                  </span>
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <X size={11} /> Limpar busca
                    </button>
                  )}
                </div>
              )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ MODAL CRIAR / EDITAR ══ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-lg animate-scaleIn max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
            {/* Header modal */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-border dark:border-border-dark flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-text-primary dark:text-stone-100">
                  {editingId ? 'Editar Cliente' : 'Novo Cliente'}
                </h2>
                <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">
                  {editingId ? 'Atualize os dados do cliente.' : 'Preencha os dados para cadastrar.'}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body modal */}
            <form
              onSubmit={handleSubmit(d => saveMutation.mutate(d))}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              {/* Nome */}
              <Field label="Nome completo *" error={errors.name?.message}>
                <input
                  type="text"
                  autoFocus
                  placeholder="Nome do cliente"
                  className="input"
                  {...register('name')}
                />
              </Field>

              {/* E-mail + Telefone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="E-mail" error={errors.email?.message}>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type="email"
                      placeholder="email@exemplo.com"
                      className="input pl-9"
                      {...register('email')}
                    />
                  </div>
                </Field>
                <Field label="Telefone / WhatsApp">
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      placeholder="(11) 99999-9999"
                      className="input pl-9"
                      {...register('phone')}
                    />
                  </div>
                </Field>
              </div>

              {/* Cidade + Estado */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Cidade">
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      placeholder="São Paulo"
                      className="input pl-9"
                      {...register('city')}
                    />
                  </div>
                </Field>
                <Field label="Estado">
                  <input
                    placeholder="SP"
                    maxLength={2}
                    className="input uppercase"
                    {...register('state')}
                  />
                </Field>
              </div>

              {/* CPF / CNPJ */}
              <Field label="CPF / CNPJ">
                <input
                  placeholder="000.000.000-00"
                  className="input"
                  {...register('cpf_cnpj')}
                />
              </Field>

              {/* Observações */}
              <Field label="Observações">
                <textarea
                  rows={2}
                  placeholder="Preferências, anotações importantes..."
                  className="input resize-none"
                  {...register('notes')}
                />
              </Field>
            </form>

            {/* Footer modal */}
            <div className="flex gap-3 p-6 pt-4 border-t border-border dark:border-border-dark flex-shrink-0">
              <button
                type="button"
                onClick={closeModal}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit(d => saveMutation.mutate(d))}
                disabled={saveMutation.isPending}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {saveMutation.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : null}
                {saveMutation.isPending ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL CONFIRMAR EXCLUSÃO ══ */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDeleteId(null)}
          />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm animate-scaleIn p-6">
            <div className="w-12 h-12 rounded-2xl bg-error-light dark:bg-error/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-error" />
            </div>
            <h3 className="text-base font-semibold text-text-primary dark:text-stone-100 text-center mb-2">
              Excluir cliente?
            </h3>
            <p className="text-sm text-text-secondary dark:text-stone-400 text-center mb-6">
              Esta ação não pode ser desfeita. O cliente será removido permanentemente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-error hover:bg-error-dark active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {deleteMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                {deleteMutation.isPending ? 'Excluindo...' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
