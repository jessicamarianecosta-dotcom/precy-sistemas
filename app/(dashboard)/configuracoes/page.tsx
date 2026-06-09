'use client'

import { useEffect, useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import {
  Building2, DollarSign, CreditCard, Trash2, Plus,
  CheckCircle, Loader2, LogOut, Key, Upload, Instagram,
  Phone, MapPin, Hash, Clock, TrendingUp, Zap, Star,
  AlertCircle,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'

/* ─────────────────────────── Types & Schemas ─── */
type Tab = 'empresa' | 'financeiro' | 'conta'

const companySchema = z.object({
  name:                 z.string().min(2, 'Nome obrigatório'),
  responsible_name:     z.string().optional(),
  phone:                z.string().optional(),
  instagram:            z.string().optional(),
  city:                 z.string().optional(),
  state:                z.string().optional(),
  cnpj:                 z.string().optional(),
  work_hours_per_month: z.coerce.number().min(1).max(744),
  email:                z.string().email('E-mail inválido').optional().or(z.literal('')),
})

const fixedCostSchema = z.object({
  name:     z.string().min(2, 'Nome obrigatório'),
  amount:   z.coerce.number().min(0.01, 'Valor obrigatório'),
  category: z.string().default('geral'),
})

type CompanyForm   = z.infer<typeof companySchema>
type FixedCostForm = z.infer<typeof fixedCostSchema>

/* ─────────────────────────── Helpers ─── */
function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

/* ─────────────────────────── Sub-components ─── */
function SavedToast({ visible }: { visible: boolean }) {
  return (
    <div className={clsx(
      'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-modal',
      'bg-white dark:bg-surface-dark border border-success/20',
      'transition-all duration-400',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
    )}>
      <div className="w-8 h-8 rounded-xl bg-success-light flex items-center justify-center flex-shrink-0">
        <CheckCircle size={16} className="text-success" />
      </div>
      <div>
        <p className="text-sm font-semibold text-text-primary dark:text-stone-100">Salvo com sucesso!</p>
        <p className="text-xs text-text-muted dark:text-stone-400">Suas alterações foram salvas.</p>
      </div>
    </div>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
      {children}
      {required && <span className="text-error ml-1">*</span>}
    </label>
  )
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border dark:border-border-dark">
      <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary/10 flex-shrink-0">
        <Icon size={18} className="text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">{title}</h3>
        {subtitle && <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

/* ─────────────────────────── Main Page ─── */
export default function ConfiguracoesPage() {
  const supabase      = createClient()
  const queryClient   = useQueryClient()
  const router        = useRouter()
  const logoInputRef  = useRef<HTMLInputElement>(null)

  const [tab,       setTab]      = useState<Tab>('empresa')
  const [userId,    setUserId]   = useState<string | null>(null)
  const [companyId, setCompanyId]= useState<string | null>(null)
  const [saved,     setSaved]    = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  /* rotina de trabalho */
  const [daysPerWeek,   setDaysPerWeek]   = useState(5)
  const [hoursPerDay,   setHoursPerDay]   = useState(8)
  const [weeksPerMonth, setWeeksPerMonth] = useState(4.3)
  const [prolabore,     setProlabore]     = useState(0)
  /* sugestão de custo */
  const [quickName,  setQuickName]  = useState('')
  const [quickValue, setQuickValue] = useState('')

  /* ── load ids ── */
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: co } = await (supabase.from('companies') as any)
        .select('id').eq('user_id', user.id).single()
      if (co?.id) setCompanyId(co.id)
    }
    load()
  }, [])

  /* ─── Queries ─── */
  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase.from('profiles') as any).select('*').eq('id', userId!).single()
      return data
    },
  })

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('companies') as any).select('*').eq('id', companyId!).single()
      return data
    },
  })

  const { data: fixedCosts } = useQuery({
    queryKey: ['fixed-costs', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('fixed_costs') as any)
        .select('*').eq('company_id', companyId!).order('created_at')
      return data ?? []
    },
  })

  const { data: subscription } = useQuery({
    queryKey: ['subscription', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase.from('subscriptions') as any)
        .select('*').eq('user_id', userId!).single()
      return data
    },
  })

  /* ─── Forms ─── */
  const coForm = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: { work_hours_per_month: 160 },
  })
  const fcForm = useForm<FixedCostForm>({
    resolver: zodResolver(fixedCostSchema),
    defaultValues: { category: 'geral' },
  })

  useEffect(() => {
    if (company) {
      // parse city/state from address if stored as "City, ST"
      const addr: string = (company as any)?.address ?? ''
      const parts = addr.includes(',') ? addr.split(',') : [addr, '']
      coForm.reset({
        name:                 (company as any)?.name ?? '',
        responsible_name:     (profile as any)?.name ?? '',
        phone:                (company as any)?.phone ?? '',
        instagram:            (company as any)?.cnpj ?? '',
        city:                 parts[0]?.trim() ?? '',
        state:                parts[1]?.trim() ?? '',
        cnpj:                 '',
        work_hours_per_month: (company as any)?.work_hours_per_month ?? 160,
        email:                (company as any)?.email ?? '',
      })
      if ((company as any)?.logo_url) setLogoPreview((company as any).logo_url)
    }
  }, [company, profile])

  /* ─── Toast ─── */
  function showSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  /* ─── Mutations ─── */
  const saveCompany = useMutation({
    mutationFn: async (d: CompanyForm) => {
      // Combine city+state into address
      const address = d.city && d.state ? `${d.city}, ${d.state}` : (d.city || d.state || '')

      await (supabase.from('companies') as any).update({
        name:                 d.name,
        phone:                d.phone,
        email:                d.email,
        cnpj:                 d.instagram, // repurpose field for instagram handle
        address:              address,
        work_hours_per_month: d.work_hours_per_month,
        updated_at:           new Date().toISOString(),
      }).eq('id', companyId!)

      // update profile name if changed
      if (d.responsible_name) {
        await (supabase.from('profiles') as any).update({
          name: d.responsible_name,
          updated_at: new Date().toISOString(),
        }).eq('id', userId!)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] })
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
      showSaved()
    },
  })

  const addCost = useMutation({
    mutationFn: async (d: FixedCostForm) => {
      await (supabase.from('fixed_costs') as any).insert([{ ...d, company_id: companyId! }])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-costs', companyId] })
      queryClient.invalidateQueries({ queryKey: ['company-pricing', companyId] })
      fcForm.reset({ name: '', amount: 0, category: 'geral' })
    },
  })

  const deleteCost = useMutation({
    mutationFn: async (id: string) => {
      await (supabase.from('fixed_costs') as any).delete().eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-costs', companyId] })
      queryClient.invalidateQueries({ queryKey: ['company-pricing', companyId] })
    },
  })

  /* ─── Logo upload ─── */
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !companyId) return
    setUploadingLogo(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `logos/${companyId}.${ext}`
      const { error } = await supabase.storage.from('company-assets').upload(path, file, { upsert: true })
      if (!error) {
        const { data: urlData } = supabase.storage.from('company-assets').getPublicUrl(path)
        await (supabase.from('companies') as any).update({ logo_url: urlData.publicUrl }).eq('id', companyId)
        setLogoPreview(urlData.publicUrl)
        queryClient.invalidateQueries({ queryKey: ['company', companyId] })
        showSaved()
      }
    } finally {
      setUploadingLogo(false)
    }
  }

  /* ─── Logout ─── */
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  /* ─── Reset password ─── */
  async function handleResetPassword() {
    const email = (profile as any)?.email ?? ''
    if (!email) return
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nova-senha`,
    })
    showSaved()
  }

  /* ─── Computed ─── */
  const totalFixedCosts = fixedCosts?.reduce((s: number, c: any) => s + Number(c.amount), 0) ?? 0
  const hoursPerMonth   = Math.round(daysPerWeek * hoursPerDay * weeksPerMonth)
  const workHours       = hoursPerMonth > 0 ? hoursPerMonth : (coForm.watch('work_hours_per_month') || 160)
  const costPerHour     = workHours > 0 ? (totalFixedCosts + prolabore) / workHours : 0
  const planStatus      = (subscription as any)?.status ?? 'trial'
  const planName        = (subscription as any)?.plan   ?? 'basic'
  const trialEndsAt     = (subscription as any)?.trial_ends_at
  const trialDaysLeft   = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0

  /* ─── Tab config ─── */
  const tabs = [
    { id: 'empresa'    as Tab, label: 'Empresa',       icon: Building2  },
    { id: 'financeiro' as Tab, label: 'Custos Fixos',  icon: DollarSign },
    { id: 'conta'      as Tab, label: 'Conta & Plano', icon: CreditCard },
  ]

  /* ══════════════════════════════════════════════ */
  return (
    <div className="page-enter min-h-screen bg-background dark:bg-background-dark">
      <Header title="Configurações" subtitle="Personalize o sistema de acordo com o seu negócio." />

      <div className="p-3 sm:p-5 lg:p-6 max-w-3xl mx-auto space-y-4">

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-2xl p-1.5 shadow-card overflow-x-auto no-scrollbar">
          {tabs.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-primary text-white shadow-btn'
                    : 'text-text-secondary dark:text-stone-400 hover:bg-primary-50 dark:hover:bg-white/5 hover:text-primary'
                )}
              >
                <Icon size={15} className="flex-shrink-0" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>

        {/* ══ TAB: EMPRESA ══════════════════════════════════════ */}
        {tab === 'empresa' && (
          <form onSubmit={coForm.handleSubmit(d => saveCompany.mutate(d))} className="space-y-4">
            {/* Dados da empresa */}
            <div className="card">
              <SectionTitle icon={Building2} title="Dados da empresa" subtitle="Informações públicas do seu negócio" />
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <FieldLabel required>Nome da empresa</FieldLabel>
                    <input
                      type="text"
                      placeholder="Ex: Ateliê da Ana"
                      className="input"
                      {...coForm.register('name')}
                    />
                    {coForm.formState.errors.name && (
                      <p className="mt-1 text-xs text-error">{coForm.formState.errors.name.message}</p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <FieldLabel>Nome do responsável</FieldLabel>
                    <input
                      type="text"
                      placeholder="Seu nome completo"
                      className="input"
                      {...coForm.register('responsible_name')}
                    />
                  </div>

                  <div>
                    <FieldLabel>WhatsApp</FieldLabel>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type="tel"
                        placeholder="41 99999-0000"
                        className="input pl-9"
                        {...coForm.register('phone')}
                      />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Instagram</FieldLabel>
                    <div className="relative">
                      <Instagram size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type="text"
                        placeholder="@seuatelie"
                        className="input pl-9"
                        {...coForm.register('instagram')}
                      />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Cidade</FieldLabel>
                    <div className="relative">
                      <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type="text"
                        placeholder="Ex: Curitiba"
                        className="input pl-9"
                        {...coForm.register('city')}
                      />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Estado</FieldLabel>
                    <input
                      type="text"
                      placeholder="PR"
                      maxLength={2}
                      className="input uppercase"
                      {...coForm.register('state')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Personalização PRO */}
            <div className="card">
              <SectionTitle icon={Star} title="Personalização PRO" subtitle="Logo e identidade visual do seu negócio" />
              <div className="space-y-4">
                {/* Logo upload */}
                <div>
                  <FieldLabel>Logo da empresa</FieldLabel>
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    className={clsx(
                      'relative flex items-center gap-4 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200',
                      'border-border dark:border-border-dark hover:border-primary hover:bg-primary-50/30 dark:hover:bg-primary/5'
                    )}
                  >
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="w-14 h-14 rounded-xl object-cover border border-border dark:border-border-dark"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {uploadingLogo
                          ? <Loader2 size={20} className="text-primary animate-spin" />
                          : <Upload size={20} className="text-primary" />
                        }
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-text-primary dark:text-stone-100">
                        {uploadingLogo ? 'Enviando...' : logoPreview ? 'Clique para trocar' : 'Clique para enviar'}
                      </p>
                      <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">PNG, JPG até 2MB</p>
                    </div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </div>
                </div>

                {/* Cores */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Cor principal</FieldLabel>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl border border-border dark:border-border-dark overflow-hidden flex-shrink-0">
                        <input type="color" defaultValue="#8B6C4F" className="w-full h-full cursor-pointer border-0 p-0" />
                      </div>
                      <input type="text" defaultValue="#8B6C4F" className="input font-mono text-sm" readOnly />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Cor secundária</FieldLabel>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl border border-border dark:border-border-dark overflow-hidden flex-shrink-0">
                        <input type="color" defaultValue="#2C2018" className="w-full h-full cursor-pointer border-0 p-0" />
                      </div>
                      <input type="text" defaultValue="#2C2018" className="input font-mono text-sm" readOnly />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-xl bg-info-light dark:bg-info/10 border border-info/20">
                  <AlertCircle size={14} className="text-info flex-shrink-0" />
                  <p className="text-xs text-info-dark dark:text-info">
                    As cores serão usadas nos PDFs de orçamento e no cabeçalho do sistema.
                  </p>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={saveCompany.isPending}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {saveCompany.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              {saveCompany.isPending ? 'Salvando...' : 'Salvar dados da empresa'}
            </button>
          </form>
        )}

        {/* ══ TAB: CUSTOS FIXOS ═══════════════════════════════ */}
        {tab === 'financeiro' && (
          <div className="space-y-5">

            {/* ── Headline guiado ── */}
            <div className="rounded-2xl p-5 border border-primary/20"
              style={{ background: 'linear-gradient(135deg, rgba(139,108,79,0.06), rgba(184,149,106,0.06))' }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-xl">💡</div>
                <div>
                  <p className="text-sm font-bold text-text-primary dark:text-stone-100">
                    Vamos calcular automaticamente o custo da sua hora
                  </p>
                  <p className="text-xs text-text-secondary dark:text-stone-400 mt-1 leading-relaxed">
                    Preencha sua rotina de trabalho e adicione seus custos fixos.
                    O sistema calcula sozinho quanto custa cada hora do seu trabalho —
                    e usa esse valor para precificar seus produtos com lucro real.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Cards de resumo ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  icon: DollarSign,
                  label: 'Custos Fixos/mês',
                  value: fmt(totalFixedCosts),
                  sub: `${(fixedCosts as any[])?.length ?? 0} itens cadastrados`,
                  color: 'text-error',
                  bg: 'bg-error-light dark:bg-error/10',
                  glow: 'hover:shadow-[0_0_20px_rgba(196,80,58,0.12)]',
                },
                {
                  icon: Clock,
                  label: 'Horas/mês',
                  value: `${hoursPerMonth}h`,
                  sub: `${daysPerWeek}d × ${hoursPerDay}h × ${weeksPerMonth}sem`,
                  color: 'text-info',
                  bg: 'bg-info-light dark:bg-info/10',
                  glow: 'hover:shadow-[0_0_20px_rgba(58,126,196,0.12)]',
                },
                {
                  icon: TrendingUp,
                  label: 'Custo/hora',
                  value: fmt(costPerHour),
                  sub: 'Calculado automaticamente',
                  color: 'text-primary',
                  bg: 'bg-primary-50 dark:bg-primary/10',
                  glow: 'hover:shadow-[0_0_20px_rgba(139,108,79,0.15)]',
                },
              ].map(card => {
                const Icon = card.icon
                return (
                  <div key={card.label} className={clsx('card flex items-center gap-3.5 p-4 transition-all duration-300', card.glow)}>
                    <div className={clsx('p-2.5 rounded-xl flex-shrink-0', card.bg)}>
                      <Icon size={18} className={card.color} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-text-muted dark:text-stone-400 uppercase tracking-wider">{card.label}</p>
                      <p className={clsx('text-lg font-bold', card.color)}>{card.value}</p>
                      <p className="text-[10px] text-text-muted dark:text-stone-500 mt-0.5 truncate">{card.sub}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Rotina de trabalho ── */}
            <div className="card">
              <SectionTitle icon={Clock} title="Sua rotina de trabalho" subtitle="Passo 1 — Diga como é o seu dia a dia de trabalho" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div>
                  <FieldLabel>Quantos dias por semana você trabalha?</FieldLabel>
                  <input
                    type="number"
                    min={1} max={7} step={1}
                    placeholder="Ex: 5"
                    className="input"
                    value={daysPerWeek}
                    onChange={e => setDaysPerWeek(Math.max(1, Math.min(7, Number(e.target.value))))}
                  />
                  <p className="mt-1 text-[10px] text-text-muted dark:text-stone-500">De 1 a 7 dias</p>
                </div>

                <div>
                  <FieldLabel>Quantas horas por dia você trabalha?</FieldLabel>
                  <input
                    type="number"
                    min={1} max={24} step={0.5}
                    placeholder="Ex: 8"
                    className="input"
                    value={hoursPerDay}
                    onChange={e => setHoursPerDay(Math.max(1, Math.min(24, Number(e.target.value))))}
                  />
                  <p className="mt-1 text-[10px] text-text-muted dark:text-stone-500">Média diária de horas produtivas</p>
                </div>

                <div>
                  <FieldLabel>Quantas semanas por mês?</FieldLabel>
                  <input
                    type="number"
                    min={1} max={5} step={0.1}
                    placeholder="Ex: 4.3"
                    className="input"
                    value={weeksPerMonth}
                    onChange={e => setWeeksPerMonth(Math.max(1, Math.min(5, Number(e.target.value))))}
                  />
                  <p className="mt-1 text-[10px] text-text-muted dark:text-stone-500">Média usada para cálculo mensal</p>
                </div>

                <div>
                  <FieldLabel>Qual o valor do seu pró-labore?</FieldLabel>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-medium">R$</span>
                    <input
                      type="number"
                      min={0} step={50}
                      placeholder="0,00"
                      className="input pl-9"
                      value={prolabore || ''}
                      onChange={e => setProlabore(Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-text-muted dark:text-stone-500">O quanto você quer receber por mês</p>
                </div>
              </div>

              {/* Cálculo ao vivo */}
              <div className="mt-4 p-4 rounded-xl border border-primary/20"
                style={{ background: 'linear-gradient(135deg, rgba(139,108,79,0.06), rgba(184,149,106,0.04))' }}>
                <p className="text-xs font-semibold text-primary mb-2">📊 Resultado automático</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] text-text-muted dark:text-stone-400">Horas/mês</p>
                    <p className="text-base font-bold text-text-primary dark:text-stone-100">
                      {daysPerWeek} × {hoursPerDay} × {weeksPerMonth} = <span className="text-primary">{hoursPerMonth}h</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted dark:text-stone-400">Custos + pró-labore</p>
                    <p className="text-base font-bold text-text-primary dark:text-stone-100">
                      <span className="text-error">{fmt(totalFixedCosts + prolabore)}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted dark:text-stone-400">Custo/hora</p>
                    <p className="text-base font-bold text-primary">{fmt(costPerHour)}/h</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  coForm.setValue('work_hours_per_month', hoursPerMonth)
                  coForm.handleSubmit(d => saveCompany.mutate(d))()
                }}
                disabled={saveCompany.isPending}
                className="btn-primary flex items-center gap-2 mt-4"
              >
                {saveCompany.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Salvar rotina de trabalho
              </button>
            </div>

            {/* ── Card explicativo ── */}
            <div className="card border-primary/20 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, #8B6C4F, #B8956A, #C4A47B)' }} />
              <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-5 pointer-events-none"
                style={{ background: '#8B6C4F' }} />
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-xl">🧮</div>
                <div>
                  <p className="text-sm font-bold text-text-primary dark:text-stone-100">Como funciona o cálculo do custo/hora?</p>
                  <p className="text-xs text-text-secondary dark:text-stone-400 mt-0.5">Entenda por que isso é essencial</p>
                </div>
              </div>
              <p className="text-sm text-text-secondary dark:text-stone-400 leading-relaxed mb-4">
                O sistema soma <strong className="text-text-primary dark:text-stone-200">seus custos fixos</strong>, seu{' '}
                <strong className="text-text-primary dark:text-stone-200">pró-labore</strong> e divide pelo total de{' '}
                <strong className="text-text-primary dark:text-stone-200">horas trabalhadas no mês</strong>.
                Assim você descobre quanto custa cada hora do seu trabalho — e usa isso para precificar com lucro real. 💡
              </p>

              {/* Exemplo visual */}
              <div className="grid grid-cols-4 gap-2 text-center mb-4">
                {[
                  { label: 'Custos fixos', value: 'R$ 2.000', color: 'text-error', bg: 'bg-error-light dark:bg-error/10' },
                  { label: 'Pró-labore', value: 'R$ 3.000', color: 'text-warning', bg: 'bg-warning-light dark:bg-warning/10' },
                  { label: 'Horas/mês', value: '160h', color: 'text-info', bg: 'bg-info-light dark:bg-info/10' },
                  { label: 'Custo/hora', value: 'R$ 31,25', color: 'text-primary', bg: 'bg-primary-50 dark:bg-primary/10' },
                ].map((item, i) => (
                  <div key={item.label}>
                    <div className={clsx('rounded-xl p-2.5 mb-1.5', item.bg)}>
                      <p className={clsx('text-sm font-bold', item.color)}>{item.value}</p>
                    </div>
                    <p className="text-[9px] text-text-muted dark:text-stone-400">{item.label}</p>
                    {i < 3 && (
                      <p className="text-xs text-text-muted mt-0.5">{i === 2 ? '=' : '+'}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-primary-50 dark:bg-primary/10 border border-primary/20">
                <AlertCircle size={13} className="text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-primary leading-relaxed">
                  Esse valor é essencial para calcular corretamente o preço dos seus produtos e garantir lucro em cada venda.
                </p>
              </div>
            </div>

            {/* ── Sugestões rápidas ── */}
            <div className="card">
              <SectionTitle icon={Zap} title="Custos Fixos Mensais" subtitle="Passo 2 — Adicione tudo que você paga todo mês" />

              {/* Sugestões de categorias */}
              <div className="mb-5">
                <p className="text-xs font-medium text-text-secondary dark:text-stone-400 mb-3 flex items-center gap-1.5">
                  <span>⚡</span> Clique para adicionar rapidamente:
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: 'Aluguel',     cat: 'aluguel',    emoji: '🏠' },
                    { name: 'Energia',     cat: 'energia',    emoji: '⚡' },
                    { name: 'Água',        cat: 'geral',      emoji: '💧' },
                    { name: 'Internet',    cat: 'internet',   emoji: '🌐' },
                    { name: 'Celular',     cat: 'geral',      emoji: '📱' },
                    { name: 'Funcionários',cat: 'pessoal',    emoji: '👥' },
                    { name: 'Pró-labore',  cat: 'pessoal',    emoji: '💼' },
                    { name: 'Canva',       cat: 'software',   emoji: '🎨' },
                    { name: 'Adobe',       cat: 'software',   emoji: '🖌️' },
                    { name: 'Domínio',     cat: 'software',   emoji: '🔗' },
                    { name: 'Hospedagem',  cat: 'software',   emoji: '☁️' },
                    { name: 'Embalagens',  cat: 'geral',      emoji: '📦' },
                    { name: 'Transporte',  cat: 'geral',      emoji: '🚗' },
                    { name: 'Combustível', cat: 'geral',      emoji: '⛽' },
                    { name: 'Marketing',   cat: 'marketing',  emoji: '📣' },
                    { name: 'Impostos',    cat: 'geral',      emoji: '📋' },
                  ].map(s => {
                    const exists = (fixedCosts as any[] ?? []).some((c: any) => c.name === s.name)
                    return (
                      <button
                        key={s.name}
                        type="button"
                        disabled={exists}
                        onClick={() => {
                          setQuickName(s.name)
                          fcForm.setValue('name', s.name)
                          fcForm.setValue('category', s.cat as any)
                          fcForm.setFocus('amount')
                        }}
                        className={clsx(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
                          exists
                            ? 'bg-success-light dark:bg-success/10 text-success-dark dark:text-success cursor-default'
                            : 'bg-white dark:bg-surface-dark border border-border dark:border-border-dark text-text-secondary dark:text-stone-400 hover:border-primary hover:text-primary hover:bg-primary-50 dark:hover:bg-primary/10 cursor-pointer'
                        )}
                      >
                        <span>{s.emoji}</span>
                        {s.name}
                        {exists && <span className="text-[10px]">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Formulário de adicionar */}
              <form
                onSubmit={fcForm.handleSubmit(d => addCost.mutate(d))}
                className="flex gap-2 flex-wrap mb-5 p-4 rounded-xl bg-primary-50/40 dark:bg-primary/5 border border-primary/10"
              >
                <input
                  className="input flex-1 min-w-36"
                  placeholder="Nome do custo (ex: Aluguel)"
                  {...fcForm.register('name')}
                />
                <input
                  type="number"
                  step="0.01"
                  className="input w-36"
                  placeholder="R$ 0,00"
                  {...fcForm.register('amount')}
                />
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
                <button
                  type="submit"
                  disabled={addCost.isPending}
                  className="btn-primary flex items-center gap-2 flex-shrink-0"
                >
                  {addCost.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Adicionar
                </button>
              </form>

              {/* Lista de custos */}
              {!(fixedCosts as any[])?.length ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center mb-3 text-2xl">
                    📋
                  </div>
                  <p className="text-sm font-semibold text-text-primary dark:text-stone-100">
                    Nenhum custo adicionado ainda
                  </p>
                  <p className="text-xs text-text-secondary dark:text-stone-400 mt-2 max-w-xs leading-relaxed">
                    Adicione seus custos para descobrir o preço ideal dos seus produtos.
                    Quanto mais completo, mais preciso fica seu lucro. 💡
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(fixedCosts as any[]).map((cost: any) => (
                    <div
                      key={cost.id}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-border dark:border-border-dark hover:border-primary/30 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Zap size={14} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary dark:text-stone-100">{cost.name}</p>
                          <span className="badge badge-primary text-[10px]">{cost.category}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-primary">{fmt(Number(cost.amount))}</span>
                        <button
                          type="button"
                          onClick={() => deleteCost.mutate(cost.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Total + frase didática */}
                  <div className="flex items-center justify-between p-4 rounded-xl mt-2"
                    style={{ background: 'linear-gradient(135deg, rgba(139,108,79,0.08), rgba(184,149,106,0.08))' }}>
                    <div className="flex items-center gap-2">
                      <Hash size={14} className="text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-text-primary dark:text-stone-100">Total mensal</p>
                        <p className="text-[10px] text-text-muted dark:text-stone-400">
                          Esses dados ajudam o sistema a calcular automaticamente o preço ideal dos seus produtos.
                        </p>
                      </div>
                    </div>
                    <span className="text-xl font-bold text-primary">{fmt(totalFixedCosts)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ TAB: CONTA & PLANO ════════════════════════════════ */}
        {tab === 'conta' && (
          <div className="space-y-4">
            {/* Plano atual */}
            <div className={clsx(
              'card relative overflow-hidden',
              planName === 'pro' ? 'border-2 border-primary' : ''
            )}>
              {planName === 'pro' && (
                <div className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: 'linear-gradient(90deg, #8B6C4F, #B8956A, #C4A47B)' }} />
              )}

              <SectionTitle icon={CreditCard} title="Meu Plano" subtitle="Status da sua assinatura" />

              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={clsx(
                      'inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full',
                      planName === 'pro'
                        ? 'bg-primary text-white'
                        : 'bg-primary-50 dark:bg-primary/10 text-primary'
                    )}>
                      {planName === 'pro' ? '⭐ Plano Pro' : '🌱 Plano Basic'}
                    </span>
                    <span className={clsx(
                      'text-xs font-semibold px-2.5 py-1 rounded-full',
                      planStatus === 'active'   ? 'bg-success-light text-success-dark' :
                      planStatus === 'trial'    ? 'bg-warning-light text-warning-dark' :
                      'bg-error-light text-error-dark'
                    )}>
                      {planStatus === 'active' ? '✅ Ativo' :
                       planStatus === 'trial'  ? `🎁 Trial — ${trialDaysLeft} dias` :
                       '❌ Expirado'}
                    </span>
                  </div>
                  {planStatus === 'trial' && trialEndsAt && (
                    <p className="text-xs text-text-muted dark:text-stone-400">
                      Trial expira em:{' '}
                      <span className="font-medium text-text-secondary dark:text-stone-300">
                        {new Date(trialEndsAt).toLocaleDateString('pt-BR')}
                      </span>
                    </p>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary/10">
                  <CreditCard size={20} className="text-primary" />
                </div>
              </div>

              {/* Upgrade */}
              {planName !== 'pro' && (
                <div className="rounded-xl p-4 border border-primary/20"
                  style={{ background: 'linear-gradient(135deg, rgba(139,108,79,0.05), rgba(184,149,106,0.05))' }}>
                  <p className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-3">
                    🚀 Desbloqueie o Plano Pro
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                    {[
                      'Pedidos ilimitados',
                      'Relatórios avançados',
                      'Sem marca d\'água no PDF',
                      'Suporte prioritário',
                      'IA de precificação',
                      'WhatsApp integrado',
                    ].map(f => (
                      <div key={f} className="flex items-center gap-2 text-xs text-text-secondary dark:text-stone-400">
                        <span className="text-success">✓</span>
                        {f}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-end gap-1 mb-3">
                    <span className="text-2xl font-bold text-primary">R$ 37</span>
                    <span className="text-text-muted mb-1">/mês</span>
                    <span className="text-xs text-text-muted mb-1 ml-1">— menos que R$1,25/dia</span>
                  </div>
                  <button className="btn-primary w-full flex items-center justify-center gap-2">
                    <Star size={15} />
                    Assinar Pro agora
                  </button>
                </div>
              )}
            </div>

            {/* Dados da conta */}
            <div className="card">
              <SectionTitle icon={Building2} title="Dados da conta" subtitle="Suas informações de acesso" />
              <div className="space-y-3">
                <div>
                  <FieldLabel>E-mail de acesso</FieldLabel>
                  <input
                    type="email"
                    className="input opacity-60 cursor-not-allowed"
                    value={(profile as any)?.email ?? ''}
                    readOnly
                  />
                  <p className="mt-1.5 text-xs text-text-muted dark:text-stone-400">
                    O e-mail não pode ser alterado por aqui.
                  </p>
                </div>
              </div>
            </div>

            {/* Segurança */}
            <div className="card">
              <SectionTitle icon={Key} title="Segurança" subtitle="Gerencie sua senha de acesso" />
              <div className="space-y-3">
                <p className="text-sm text-text-secondary dark:text-stone-400">
                  Para trocar sua senha, enviaremos um link para o seu e-mail cadastrado.
                </p>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Key size={15} />
                  Enviar link para trocar senha
                </button>
              </div>
            </div>

            {/* Danger zone */}
            <div className="card border-error/20">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border dark:border-border-dark">
                <div className="p-2 rounded-xl bg-error-light flex-shrink-0">
                  <LogOut size={18} className="text-error" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Sair da conta</h3>
                  <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">Encerrar sessão no sistema</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-error border border-error/30 hover:bg-error-light transition-all duration-200"
              >
                <LogOut size={15} />
                Sair do Precy+
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast global */}
      <SavedToast visible={saved} />
    </div>
  )
}
