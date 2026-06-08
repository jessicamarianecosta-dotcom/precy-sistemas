'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import {
  Settings, User, Building2, CreditCard, DollarSign,
  Plus, Trash2, X, Loader2, Save, CheckCircle
} from 'lucide-react'
import { clsx } from 'clsx'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

type Tab = 'perfil' | 'empresa' | 'custos' | 'plano'

const profileSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
})
const companySchema = z.object({
  name:                  z.string().min(2, 'Nome do negócio obrigatório'),
  email:                 z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone:                 z.string().optional(),
  cnpj:                  z.string().optional(),
  address:               z.string().optional(),
  work_hours_per_month:  z.coerce.number().min(1).max(744),
})
const fixedCostSchema = z.object({
  name:     z.string().min(2, 'Nome obrigatório'),
  amount:   z.coerce.number().min(0.01, 'Valor obrigatório'),
  category: z.string().default('geral'),
})

type ProfileForm    = z.infer<typeof profileSchema>
type CompanyForm    = z.infer<typeof companySchema>
type FixedCostForm  = z.infer<typeof fixedCostSchema>

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function ConfiguracoesPage() {
  const supabase      = createClient()
  const queryClient   = useQueryClient()
  const [tab,    setTab]    = useState<Tab>('perfil')
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: co } = await supabase.from('companies').select('id').eq('user_id', user.id).single()
      if (co) setCompanyId(co.id)
    }
    load()
  }, [])

  /* ─── Queries ─── */
  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    enabled:  !!userId,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId!).single()
      return data
    },
  })

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    enabled:  !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from('companies').select('*').eq('id', companyId!).single()
      return data
    },
  })

  const { data: fixedCosts } = useQuery({
    queryKey: ['fixed-costs', companyId],
    enabled:  !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from('fixed_costs').select('*').eq('company_id', companyId!).order('created_at')
      return data ?? []
    },
  })

  const { data: subscription } = useQuery({
    queryKey: ['subscription', userId],
    enabled:  !!userId,
    queryFn: async () => {
      const { data } = await supabase.from('subscriptions').select('*').eq('user_id', userId!).single()
      return data
    },
  })

  /* ─── Forms ─── */
  const profForm = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) })
  const coForm   = useForm<CompanyForm>({ resolver: zodResolver(companySchema) })
  const fcForm   = useForm<FixedCostForm>({ resolver: zodResolver(fixedCostSchema), defaultValues: { category: 'geral' } })

  useEffect(() => {
    if (profile) profForm.reset({ name: profile.name ?? '' })
  }, [profile])
  useEffect(() => {
    if (company) coForm.reset({
      name:                 company.name,
      email:                company.email ?? '',
      phone:                company.phone ?? '',
      cnpj:                 company.cnpj  ?? '',
      address:              company.address ?? '',
      work_hours_per_month: company.work_hours_per_month ?? 160,
    })
  }, [company])

  /* ─── Mutations ─── */
  function showSaved() { setSaved(true); setTimeout(() => setSaved(false), 2500) }

  const saveProfile = useMutation({
    mutationFn: async (d: ProfileForm) => {
      await supabase.from('profiles').update({ name: d.name, updated_at: new Date().toISOString() }).eq('id', userId!)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['profile', userId] }); showSaved() },
  })

  const saveCompany = useMutation({
    mutationFn: async (d: CompanyForm) => {
      await supabase.from('companies').update({ ...d, updated_at: new Date().toISOString() }).eq('id', companyId!)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['company', companyId] }); showSaved() },
  })

  const addCost = useMutation({
    mutationFn: async (d: FixedCostForm) => {
      await supabase.from('fixed_costs').insert({ ...d, company_id: companyId! })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-costs',    companyId] })
      queryClient.invalidateQueries({ queryKey: ['company-pricing', companyId] })
      fcForm.reset({ name: '', amount: 0, category: 'geral' })
    },
  })

  const deleteCost = useMutation({
    mutationFn: async (id: string) => { await supabase.from('fixed_costs').delete().eq('id', id) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-costs',    companyId] })
      queryClient.invalidateQueries({ queryKey: ['company-pricing', companyId] })
    },
  })

  const totalFixedCosts = fixedCosts?.reduce((s, c) => s + Number(c.amount), 0) ?? 0

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'perfil',  label: 'Perfil',       icon: User      },
    { id: 'empresa', label: 'Meu Negócio',  icon: Building2 },
    { id: 'custos',  label: 'Custos Fixos', icon: DollarSign},
    { id: 'plano',   label: 'Meu Plano',    icon: CreditCard},
  ]

  return (
    <div className="page-enter">
      <Header title="Configurações" subtitle="Gerencie sua conta e empresa" />
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar de abas */}
          <div className="lg:col-span-1">
            <div className="card p-2 space-y-1">
              {tabs.map(t => {
                const Icon = t.icon
                return (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={clsx('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                      tab === t.id
                        ? 'bg-primary text-white'
                        : 'text-text-secondary dark:text-stone-400 hover:bg-primary-50 dark:hover:bg-white/5 hover:text-primary'
                    )}>
                    <Icon size={16} />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Conteúdo */}
          <div className="lg:col-span-3 space-y-4">
            {/* Salvo */}
            {saved && (
              <div className="flex items-center gap-2 bg-success-light text-success-dark px-4 py-3 rounded-xl border border-success/20 text-sm font-medium animate-fadeIn">
                <CheckCircle size={16} /> Alterações salvas!
              </div>
            )}

            {/* ── PERFIL ── */}
            {tab === 'perfil' && (
              <div className="card space-y-5">
                <div className="flex items-center gap-3 pb-2 border-b border-border dark:border-border-dark">
                  <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary/10"><User size={18} className="text-primary" /></div>
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Perfil</h2>
                    <p className="text-xs text-text-muted">Seus dados pessoais</p>
                  </div>
                </div>
                <form onSubmit={profForm.handleSubmit(d => saveProfile.mutate(d))} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Seu nome</label>
                    <input className="input" {...profForm.register('name')} />
                    {profForm.formState.errors.name && <p className="mt-1 text-xs text-error">{profForm.formState.errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">E-mail</label>
                    <input className="input opacity-60 cursor-not-allowed" value={profile?.email ?? ''} readOnly />
                    <p className="mt-1 text-xs text-text-muted">O e-mail não pode ser alterado por aqui.</p>
                  </div>
                  <button type="submit" disabled={saveProfile.isPending} className="btn-primary flex items-center gap-2">
                    {saveProfile.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {saveProfile.isPending ? 'Salvando...' : 'Salvar Perfil'}
                  </button>
                </form>
              </div>
            )}

            {/* ── EMPRESA ── */}
            {tab === 'empresa' && (
              <div className="card space-y-5">
                <div className="flex items-center gap-3 pb-2 border-b border-border dark:border-border-dark">
                  <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary/10"><Building2 size={18} className="text-primary" /></div>
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Meu Negócio</h2>
                    <p className="text-xs text-text-muted">Dados da sua empresa</p>
                  </div>
                </div>
                <form onSubmit={coForm.handleSubmit(d => saveCompany.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Nome do negócio *</label>
                      <input className="input" {...coForm.register('name')} />
                      {coForm.formState.errors.name && <p className="mt-1 text-xs text-error">{coForm.formState.errors.name.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">E-mail comercial</label>
                      <input type="email" className="input" {...coForm.register('email')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Telefone</label>
                      <input className="input" placeholder="(11) 99999-9999" {...coForm.register('phone')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">CNPJ / CPF</label>
                      <input className="input" {...coForm.register('cnpj')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                        Horas de trabalho/mês
                        <span className="text-text-muted font-normal ml-1">(para cálculo de custo/hora)</span>
                      </label>
                      <input type="number" className="input" min={1} max={744} {...coForm.register('work_hours_per_month')} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Endereço</label>
                      <input className="input" {...coForm.register('address')} />
                    </div>
                  </div>
                  <button type="submit" disabled={saveCompany.isPending} className="btn-primary flex items-center gap-2">
                    {saveCompany.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {saveCompany.isPending ? 'Salvando...' : 'Salvar Empresa'}
                  </button>
                </form>
              </div>
            )}

            {/* ── CUSTOS FIXOS ── */}
            {tab === 'custos' && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="card bg-gradient-primary text-white">
                  <p className="text-sm opacity-80 mb-1">Total de Custos Fixos Mensais</p>
                  <p className="text-3xl font-bold">{fmt(totalFixedCosts)}</p>
                  <p className="text-sm opacity-70 mt-1">
                    Custo/hora: {fmt(totalFixedCosts / (company?.work_hours_per_month ?? 160))} · {company?.work_hours_per_month ?? 160}h/mês
                  </p>
                </div>

                {/* Add form */}
                <div className="card space-y-4">
                  <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 flex items-center gap-2">
                    <Plus size={15} className="text-primary" /> Adicionar Custo Fixo
                  </h3>
                  <form onSubmit={fcForm.handleSubmit(d => addCost.mutate(d))} className="flex gap-2 flex-wrap">
                    <input className="input flex-1 min-w-36" placeholder="Nome (ex: Aluguel)" {...fcForm.register('name')} />
                    <input type="number" step="0.01" className="input w-32" placeholder="R$ 0,00" {...fcForm.register('amount')} />
                    <select className="input w-36" {...fcForm.register('category')}>
                      <option value="geral">Geral</option>
                      <option value="aluguel">Aluguel</option>
                      <option value="energia">Energia</option>
                      <option value="internet">Internet</option>
                      <option value="software">Software</option>
                      <option value="marketing">Marketing</option>
                      <option value="pessoal">Pessoal</option>
                      <option value="equipamento">Equipamento</option>
                    </select>
                    <button type="submit" disabled={addCost.isPending} className="btn-primary flex items-center gap-2">
                      {addCost.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Adicionar
                    </button>
                  </form>
                </div>

                {/* List */}
                <div className="card p-0 overflow-hidden">
                  {!fixedCosts?.length ? (
                    <div className="p-8 text-center">
                      <DollarSign size={28} className="text-text-muted mx-auto mb-2" />
                      <p className="text-sm text-text-muted">Nenhum custo fixo cadastrado.</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border dark:border-border-dark">
                          {['Nome', 'Categoria', 'Valor Mensal', ''].map(h => (
                            <th key={h} className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider p-4">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fixedCosts.map(cost => (
                          <tr key={cost.id} className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/30 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="p-4 text-sm font-medium text-text-primary dark:text-stone-100">{cost.name}</td>
                            <td className="p-4"><span className="badge badge-primary">{cost.category}</span></td>
                            <td className="p-4 text-sm font-bold text-primary">{fmt(Number(cost.amount))}</td>
                            <td className="p-4">
                              <button onClick={() => deleteCost.mutate(cost.id)} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-primary-50 dark:bg-primary/10">
                          <td colSpan={2} className="p-4 text-sm font-bold text-text-primary dark:text-stone-100">Total Mensal</td>
                          <td className="p-4 text-base font-bold text-primary">{fmt(totalFixedCosts)}</td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ── PLANO ── */}
            {tab === 'plano' && (
              <div className="space-y-4">
                {/* Plano Atual */}
                <div className="card border-2 border-primary">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="badge badge-primary mb-2">Plano Atual</span>
                      <h2 className="text-xl font-bold text-text-primary dark:text-stone-100 mb-1 capitalize">
                        {subscription?.plan === 'pro' ? '⭐ Pro' : '🌱 Basic (Trial)'}
                      </h2>
                      <p className="text-sm text-text-secondary dark:text-stone-400">
                        Status: <span className={clsx('font-semibold',
                          subscription?.status === 'active' ? 'text-success' :
                          subscription?.status === 'trial'  ? 'text-warning' : 'text-error'
                        )}>
                          {subscription?.status === 'trial'  ? '🎁 Trial gratuito' :
                           subscription?.status === 'active' ? '✅ Ativo' : '❌ Expirado'}
                        </span>
                      </p>
                      {subscription?.trial_ends_at && subscription.status === 'trial' && (
                        <p className="text-xs text-text-muted mt-1">
                          Trial expira em: {new Date(subscription.trial_ends_at).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary/10">
                      <CreditCard size={24} className="text-primary" />
                    </div>
                  </div>
                </div>

                {/* Upgrade */}
                {subscription?.plan !== 'pro' && (
                  <div className="card space-y-4">
                    <h3 className="text-base font-bold text-text-primary dark:text-stone-100">Upgrade para Pro 🚀</h3>
                    <ul className="space-y-2 text-sm text-text-secondary dark:text-stone-400">
                      {[
                        'Pedidos e orçamentos ilimitados',
                        'Relatórios avançados com exportação',
                        'Calculadora de precificação com IA',
                        'WhatsApp integrado para notificações',
                        'Suporte prioritário',
                        'Sem marca d\'água nos PDFs',
                      ].map(f => (
                        <li key={f} className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-success flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-bold text-primary">R$ 49</span>
                      <span className="text-text-muted mb-1">/mês</span>
                    </div>
                    <button className="btn-primary w-full flex items-center justify-center gap-2">
                      <CreditCard size={16} />
                      Assinar Pro — R$ 49/mês
                    </button>
                    <p className="text-xs text-text-muted text-center">Cancele quando quiser · Pagamento seguro via Stripe</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
