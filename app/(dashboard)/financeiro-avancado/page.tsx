'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { useCompanyId } from '@/hooks/useCompanyId'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils/format'
import { LucideIcon } from 'lucide-react'
import {
  TrendingUp, Tag, Plus, X, Loader2, Trash2, Edit2,
  Lock, Clock3, RefreshCcw, Target, LineChart, BellRing,
  Award, ChevronRight, Sparkles, CheckCircle, Calendar,
  AlertTriangle, PauseCircle, PlayCircle, Zap,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, addDays, addWeeks, addMonths, addYears, isPast, differenceInDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

/* ════════════════════════════════════════════════════════════
   TIPOS
═══════════════════════════════════════════════════════════ */
type Tab = 'visao_geral' | 'centro_custos' | 'recorrentes' | 'fluxo_caixa' | 'dre' | 'metas' | 'projecao' | 'lucratividade'

interface CostCenter {
  id:         string
  name:       string
  color:      string
  icon:       string
  is_default: boolean
  is_active:  boolean
  total?:     number
}

interface RecurringBill {
  id:             string
  name:           string
  amount:         number
  periodicity:    'weekly' | 'biweekly' | 'monthly' | 'yearly'
  due_day:        number | null
  next_due_date:  string
  is_active:      boolean
  notes:          string | null
  cost_center_id: string | null
}

const recurringBillSchema = z.object({
  name:        z.string().min(2, 'Nome obrigatório').max(60),
  amount:      z.coerce.number().min(0.01, 'Valor obrigatório'),
  periodicity: z.enum(['weekly', 'biweekly', 'monthly', 'yearly']),
  next_due_date: z.string().min(1, 'Data de vencimento obrigatória'),
  cost_center_id: z.string().optional(),
  notes:       z.string().optional(),
})
type RecurringBillForm = z.infer<typeof recurringBillSchema>

const PERIODICITY_LABELS: Record<string, string> = {
  weekly: 'Semanal', biweekly: 'Quinzenal', monthly: 'Mensal', yearly: 'Anual',
}

function nextDueFrom(date: Date, periodicity: string): Date {
  switch (periodicity) {
    case 'weekly':   return addWeeks(date, 1)
    case 'biweekly': return addDays(date, 14)
    case 'yearly':   return addYears(date, 1)
    default:         return addMonths(date, 1)
  }
}

const costCenterSchema = z.object({
  name:  z.string().min(2, 'Nome obrigatório').max(40, 'Máximo 40 caracteres'),
  color: z.string().min(4),
  icon:  z.string().min(1).max(4),
})
type CostCenterForm = z.infer<typeof costCenterSchema>

const ICON_OPTIONS = ['📊', '📦', '📣', '⚡', '💧', '🌐', '🏠', '💰', '📋', '🛠️', '🚗', '📈', '🎨', '✂️', '📱', '🧾']
const COLOR_OPTIONS = ['#8B6C4F', '#B45309', '#7C3AED', '#D97706', '#0891B2', '#2563EB', '#DC2626', '#059669', '#4B5563', '#9333EA', '#0D9488', '#1D4ED8']

/* ════════════════════════════════════════════════════════════
   PÁGINA
═══════════════════════════════════════════════════════════ */
export default function FinanceiroAvancadoPage() {
  const supabase     = createClient()
  const queryClient  = useQueryClient()
  const { toast }    = useToast()
  const { companyId } = useCompanyId()

  const [tab, setTab] = useState<Tab>('visao_geral')

  const tabs: { id: Tab; label: string; icon: LucideIcon; ready: boolean }[] = [
    { id: 'visao_geral',    label: 'Visão Geral',        icon: Sparkles,    ready: true  },
    { id: 'centro_custos',  label: 'Centro de Custos',   icon: Tag,         ready: true  },
    { id: 'recorrentes',    label: 'Contas Recorrentes', icon: RefreshCcw,  ready: true  },
    { id: 'fluxo_caixa',    label: 'Fluxo de Caixa',     icon: LineChart,   ready: true  },
    { id: 'dre',            label: 'DRE Simplificado',   icon: TrendingUp,  ready: false },
    { id: 'metas',          label: 'Metas Financeiras',  icon: Target,      ready: false },
    { id: 'projecao',       label: 'Projeção de Caixa',  icon: Clock3,      ready: false },
    { id: 'lucratividade',  label: 'Lucratividade',      icon: Award,       ready: false },
  ]

  return (
    <div className="page-enter min-h-screen bg-background dark:bg-background-dark">
      <Header
        title="Financeiro Avançado"
        subtitle="Ferramentas profissionais de gestão financeira para o seu negócio"
      />

      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {tabs.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0',
                  active
                    ? 'bg-primary text-white shadow-btn'
                    : 'bg-white dark:bg-surface-dark border border-border dark:border-border-dark text-text-secondary dark:text-stone-400 hover:border-primary/40 hover:text-primary'
                )}
              >
                <Icon size={15} />
                {t.label}
                {!t.ready && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-warning-light dark:bg-warning/15 text-warning-dark dark:text-warning">
                    em breve
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {tab === 'visao_geral' && <VisaoGeralTab onNavigate={setTab} />}
        {tab === 'centro_custos' && (
          <CentroCustosTab
            companyId={companyId}
            supabase={supabase}
            queryClient={queryClient}
            toast={toast}
          />
        )}
        {tab === 'recorrentes' && (
          <RecorrentesTab
            companyId={companyId}
            supabase={supabase}
            queryClient={queryClient}
            toast={toast}
          />
        )}
        {tab === 'fluxo_caixa' && (
          <FluxoCaixaTab companyId={companyId} supabase={supabase} />
        )}
        {tab !== 'visao_geral' && tab !== 'centro_custos' && tab !== 'recorrentes' && tab !== 'fluxo_caixa' && (
          <ModuloEmBreve tabs={tabs} tab={tab} />
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   ABA: VISÃO GERAL — hub dos módulos
═══════════════════════════════════════════════════════════ */
function VisaoGeralTab({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const cards: { id: Tab; title: string; desc: string; icon: LucideIcon; ready: boolean }[] = [
    { id: 'centro_custos', title: 'Centro de Custos',   desc: 'Organize suas despesas por categoria customizada',    icon: Tag,        ready: true  },
    { id: 'recorrentes',   title: 'Contas Recorrentes', desc: 'Assinaturas e contas fixas geradas automaticamente',  icon: RefreshCcw, ready: true  },
    { id: 'fluxo_caixa',   title: 'Fluxo de Caixa',     desc: 'Entradas, saídas e saldo em qualquer período',        icon: LineChart,  ready: true  },
    { id: 'dre',           title: 'DRE Simplificado',   desc: 'Receita, custos, despesas e lucro líquido',           icon: TrendingUp, ready: false },
    { id: 'metas',         title: 'Metas Financeiras',  desc: 'Acompanhe faturamento e lucro com metas mensais',     icon: Target,     ready: false },
    { id: 'projecao',      title: 'Projeção de Caixa',  desc: 'Previsão de saldo para os próximos 90 dias',          icon: Clock3,     ready: false },
    { id: 'lucratividade', title: 'Lucratividade',      desc: 'Produtos mais e menos lucrativos do seu negócio',     icon: Award,      ready: false },
  ]

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5 border border-primary/20 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(139,108,79,0.08), rgba(184,149,106,0.05))' }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-xl">💎</div>
          <div>
            <p className="text-sm font-bold text-text-primary dark:text-stone-100">Bem-vinda ao Financeiro Avançado</p>
            <p className="text-xs text-text-secondary dark:text-stone-400 mt-1 leading-relaxed">
              Um conjunto de ferramentas profissionais — exclusivo do plano PRO — para você entender
              de verdade a saúde financeira do seu negócio. Os módulos estão sendo lançados em etapas.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(c => {
          const Icon = c.icon
          return (
            <button
              key={c.id}
              onClick={() => c.ready && onNavigate(c.id)}
              disabled={!c.ready}
              className={clsx(
                'card text-left p-4 transition-all duration-200 group relative overflow-hidden',
                c.ready
                  ? 'hover:border-primary/40 hover:shadow-card cursor-pointer'
                  : 'opacity-60 cursor-not-allowed'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center">
                  <Icon size={18} className="text-primary" />
                </div>
                {c.ready ? (
                  <ChevronRight size={16} className="text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                ) : (
                  <Lock size={14} className="text-text-muted" />
                )}
              </div>
              <p className="text-sm font-semibold text-text-primary dark:text-stone-100">{c.title}</p>
              <p className="text-xs text-text-muted dark:text-stone-400 mt-1 leading-relaxed">{c.desc}</p>
              {!c.ready && (
                <span className="inline-block mt-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-warning-light dark:bg-warning/15 text-warning-dark dark:text-warning">
                  Em breve
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   ABA: MÓDULO EM BREVE
═══════════════════════════════════════════════════════════ */
function ModuloEmBreve({ tabs, tab }: { tabs: { id: Tab; label: string; icon: LucideIcon }[]; tab: Tab }) {
  const current = tabs.find(t => t.id === tab)
  const Icon = current?.icon ?? Clock3
  return (
    <EmptyState
      icon={Icon}
      title={`${current?.label} — em desenvolvimento`}
      description="Este módulo está sendo construído com cuidado e chegará em uma próxima atualização do Precy+."
    />
  )
}

/* ════════════════════════════════════════════════════════════
   ABA: CENTRO DE CUSTOS
═══════════════════════════════════════════════════════════ */
function CentroCustosTab({
  companyId, supabase, queryClient, toast,
}: {
  companyId: string | null
  supabase: ReturnType<typeof createClient>
  queryClient: ReturnType<typeof useQueryClient>
  toast: (type: 'success' | 'error', msg: string) => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<CostCenter | null>(null)
  const [deleteId,  setDeleteId]  = useState<string | null>(null)
  const [seeding,   setSeeding]   = useState(false)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CostCenterForm>({
    resolver: zodResolver(costCenterSchema),
    defaultValues: { name: '', color: COLOR_OPTIONS[0], icon: ICON_OPTIONS[0] },
  })

  const { data: costCenters, isLoading } = useQuery<CostCenter[]>({
    queryKey: ['cost-centers', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data: centers, error } = await (supabase.from('cost_centers') as any)
        .select('*')
        .eq('company_id', companyId!)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name')
      if (error) throw error

      const startOfMonth = new Date(); startOfMonth.setDate(1)
      const { data: txs } = await (supabase.from('financial_transactions') as any)
        .select('cost_center_id, amount')
        .eq('company_id', companyId!)
        .eq('type', 'expense')
        .gte('date', startOfMonth.toISOString().split('T')[0])
        .not('cost_center_id', 'is', null)

      const totals = new Map<string, number>()
      ;(txs ?? []).forEach((t: any) => {
        totals.set(t.cost_center_id, (totals.get(t.cost_center_id) ?? 0) + Number(t.amount))
      })

      return (centers ?? []).map((c: any) => ({ ...c, total: totals.get(c.id) ?? 0 }))
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (d: CostCenterForm) => {
      if (!companyId) throw new Error('Empresa não identificada')
      if (editing) {
        const { error } = await (supabase.from('cost_centers') as any)
          .update({ ...d, updated_at: new Date().toISOString() })
          .eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await (supabase.from('cost_centers') as any)
          .insert([{ ...d, company_id: companyId }])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers', companyId] })
      toast('success', editing ? 'Centro de custo atualizado!' : 'Centro de custo criado!')
      closeModal()
    },
    onError: (err: Error) => {
      const msg = err.message.includes('duplicate')
        ? 'Já existe um centro de custo com esse nome.'
        : `Erro ao salvar: ${err.message}`
      toast('error', msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('cost_centers') as any)
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers', companyId] })
      toast('success', 'Centro de custo removido.')
      setDeleteId(null)
    },
    onError: (err: Error) => toast('error', `Erro ao remover: ${err.message}`),
  })

  async function handleSeedDefaults() {
    if (!companyId) return
    setSeeding(true)
    try {
      const { error } = await supabase.rpc('seed_default_cost_centers' as never, { p_company_id: companyId } as never)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['cost-centers', companyId] })
      toast('success', 'Categorias padrão adicionadas!')
    } catch (err: unknown) {
      toast('error', `Erro ao criar categorias padrão: ${(err as Error).message}`)
    } finally {
      setSeeding(false)
    }
  }

  function openEdit(c: CostCenter) {
    setEditing(c)
    setValue('name', c.name)
    setValue('color', c.color)
    setValue('icon', c.icon)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    reset({ name: '', color: COLOR_OPTIONS[0], icon: ICON_OPTIONS[0] })
  }

  const totalGeral = (costCenters ?? []).reduce((s, c) => s + (c.total ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-text-primary dark:text-stone-100">Centro de Custos</p>
          <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">
            Organize suas despesas por categoria e veja onde seu dinheiro está indo
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Novo centro de custo
        </button>
      </div>

      {(costCenters?.length ?? 0) > 0 && (
        <div className="card flex items-center justify-between p-4">
          <div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Total gasto este mês</p>
            <p className="text-xl font-bold text-primary mt-0.5">{formatCurrency(totalGeral)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Centros ativos</p>
            <p className="text-xl font-bold text-text-primary dark:text-stone-100 mt-0.5">{costCenters?.length ?? 0}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3].map(i => <div key={i} className="card h-24 animate-pulse bg-primary-50/50 dark:bg-white/5" />)}
        </div>
      ) : !costCenters?.length ? (
        <EmptyState
          icon={Tag}
          title="Nenhum centro de custo ainda"
          description="Crie categorias para organizar suas despesas, ou use nosso conjunto de categorias prontas para o seu tipo de negócio."
          action={{ label: seeding ? 'Criando...' : '✨ Usar categorias padrão', onClick: handleSeedDefaults }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {costCenters.map(c => (
            <div key={c.id} className="card p-4 group relative overflow-hidden">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: `${c.color}1A` }}
                  >
                    {c.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary dark:text-stone-100 leading-snug break-words">{c.name}</p>
                    {c.is_default && (
                      <span className="text-[9px] font-medium text-text-muted">Categoria padrão</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border dark:border-border-dark">
                <span className="text-[10px] text-text-muted dark:text-stone-500">Gasto este mês</span>
                <span className="text-sm font-bold" style={{ color: c.color }}>{formatCurrency(c.total ?? 0)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-md animate-scaleIn">
            <div className="p-5 pb-3 border-b border-border dark:border-border-dark flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                {editing ? 'Editar centro de custo' : 'Novo centro de custo'}
              </h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Nome</label>
                <input className="input" placeholder="Ex: Matéria-prima" {...register('name')} />
                {errors.name && <p className="mt-1 text-xs text-error">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Ícone</label>
                <div className="flex flex-wrap gap-1.5">
                  {ICON_OPTIONS.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setValue('icon', icon)}
                      className={clsx(
                        'w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all',
                        watch('icon') === icon
                          ? 'bg-primary/15 border-2 border-primary'
                          : 'bg-primary-50/50 dark:bg-white/5 border border-transparent hover:border-primary/30'
                      )}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Cor</label>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_OPTIONS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setValue('color', color)}
                      className={clsx(
                        'w-8 h-8 rounded-full transition-all flex items-center justify-center',
                        watch('color') === color && 'ring-2 ring-offset-2 ring-primary dark:ring-offset-surface-dark'
                      )}
                      style={{ background: color }}
                    >
                      {watch('color') === color && <CheckCircle size={14} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saveMutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm p-5 animate-scaleIn">
            <p className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-1">Remover centro de custo?</p>
            <p className="text-xs text-text-muted dark:text-stone-400 mb-4">
              As despesas já lançadas continuam no histórico, apenas o centro de custo deixa de aparecer na lista.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-error hover:bg-error-dark transition-colors disabled:opacity-60"
              >
                {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   ABA: CONTAS RECORRENTES
═══════════════════════════════════════════════════════════ */
function RecorrentesTab({
  companyId, supabase, queryClient, toast,
}: {
  companyId: string | null
  supabase: ReturnType<typeof createClient>
  queryClient: ReturnType<typeof useQueryClient>
  toast: (type: 'success' | 'error', msg: string) => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<RecurringBill | null>(null)
  const [deleteId,  setDeleteId]  = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const generationChecked = useRef(false)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<RecurringBillForm>({
    resolver: zodResolver(recurringBillSchema),
    defaultValues: {
      name: '', amount: 0, periodicity: 'monthly',
      next_due_date: format(new Date(), 'yyyy-MM-dd'), notes: '',
    },
  })

  /* ── Centros de custo (para vincular, opcional) ── */
  const { data: costCenters } = useQuery<CostCenter[]>({
    queryKey: ['cost-centers', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data } = await (supabase.from('cost_centers') as any)
        .select('id, name, color, icon, is_default, is_active')
        .eq('company_id', companyId!)
        .eq('is_active', true)
        .order('name')
      return data ?? []
    },
  })

  /* ── Contas recorrentes ── */
  const { data: bills, isLoading } = useQuery<RecurringBill[]>({
    queryKey: ['recurring-bills', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data, error } = await (supabase.from('recurring_bills') as any)
        .select('*')
        .eq('company_id', companyId!)
        .eq('is_active', true)
        .order('next_due_date')
      if (error) throw error
      return data ?? []
    },
  })

  /* ── Geração automática "lazy": ao abrir a aba, verifica vencidas e gera o lançamento ──
     Roda uma única vez por sessão de visualização desta aba. */
  useEffect(() => {
    if (!bills || !companyId || generationChecked.current) return
    generationChecked.current = true

    const overdue = bills.filter(b => isPast(new Date(b.next_due_date + 'T00:00:00')))
    if (overdue.length === 0) return

    async function generateOverdueBills() {
      setGenerating(true)
      try {
        for (const bill of overdue) {
          // Anti-duplicação: verificar se já existe lançamento para esta conta neste vencimento
          const { data: existing } = await (supabase.from('financial_transactions') as any)
            .select('id')
            .eq('recurring_bill_id', bill.id)
            .eq('date', bill.next_due_date)
            .maybeSingle()

          if (!existing) {
            await (supabase.from('financial_transactions') as any).insert([{
              company_id:       companyId,
              type:              'expense',
              category:          'outros',
              amount:            bill.amount,
              description:       `${bill.name} (conta recorrente)`,
              date:              bill.next_due_date,
              status:            'to_pay',
              cost_center_id:    bill.cost_center_id,
              recurring_bill_id: bill.id,
            }])
          }

          // Avançar para o próximo vencimento (mesmo se já existia, garante consistência)
          const newNextDue = nextDueFrom(new Date(bill.next_due_date + 'T00:00:00'), bill.periodicity)
          await (supabase.from('recurring_bills') as any)
            .update({ next_due_date: format(newNextDue, 'yyyy-MM-dd'), updated_at: new Date().toISOString() })
            .eq('id', bill.id)
        }

        queryClient.invalidateQueries({ queryKey: ['recurring-bills', companyId] })
        queryClient.invalidateQueries({ queryKey: ['financial-transactions', companyId] })
        queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] })
        toast('success', `${overdue.length} conta(s) recorrente(s) lançada(s) automaticamente no Financeiro!`)
      } catch (err: unknown) {
        console.error('[recorrentes] geração automática:', err)
      } finally {
        setGenerating(false)
      }
    }

    generateOverdueBills()
  }, [bills, companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Mutations ── */
  const saveMutation = useMutation({
    mutationFn: async (d: RecurringBillForm) => {
      if (!companyId) throw new Error('Empresa não identificada')
      const payload = {
        name:           d.name,
        amount:         d.amount,
        periodicity:    d.periodicity,
        next_due_date:  d.next_due_date,
        cost_center_id: d.cost_center_id || null,
        notes:          d.notes || null,
      }
      if (editing) {
        const { error } = await (supabase.from('recurring_bills') as any)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await (supabase.from('recurring_bills') as any)
          .insert([{ ...payload, company_id: companyId }])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-bills', companyId] })
      toast('success', editing ? 'Conta recorrente atualizada!' : 'Conta recorrente criada!')
      closeModal()
    },
    onError: (err: Error) => toast('error', `Erro ao salvar: ${err.message}`),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('recurring_bills') as any)
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-bills', companyId] })
      toast('success', 'Conta recorrente removida.')
      setDeleteId(null)
    },
    onError: (err: Error) => toast('error', `Erro ao remover: ${err.message}`),
  })

  function openEdit(b: RecurringBill) {
    setEditing(b)
    setValue('name', b.name)
    setValue('amount', b.amount)
    setValue('periodicity', b.periodicity)
    setValue('next_due_date', b.next_due_date)
    setValue('cost_center_id', b.cost_center_id ?? '')
    setValue('notes', b.notes ?? '')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    reset({ name: '', amount: 0, periodicity: 'monthly', next_due_date: format(new Date(), 'yyyy-MM-dd'), notes: '' })
  }

  const totalMensal = (bills ?? []).reduce((s, b) => {
    const monthlyEquivalent =
      b.periodicity === 'weekly'   ? b.amount * 4.33 :
      b.periodicity === 'biweekly' ? b.amount * 2.17 :
      b.periodicity === 'yearly'   ? b.amount / 12 :
      b.amount
    return s + monthlyEquivalent
  }, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-text-primary dark:text-stone-100">Contas Recorrentes</p>
          <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">
            Assinaturas e contas fixas — lançadas automaticamente quando vencem
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Nova conta recorrente
        </button>
      </div>

      {generating && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-info-light dark:bg-info/10 border border-info/20">
          <Loader2 size={14} className="text-info animate-spin flex-shrink-0" />
          <p className="text-xs text-info-dark dark:text-info">Verificando contas vencidas e lançando no Financeiro...</p>
        </div>
      )}

      {(bills?.length ?? 0) > 0 && (
        <div className="card flex items-center justify-between p-4">
          <div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Equivalente mensal</p>
            <p className="text-xl font-bold text-primary mt-0.5">{formatCurrency(totalMensal)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Contas ativas</p>
            <p className="text-xl font-bold text-text-primary dark:text-stone-100 mt-0.5">{bills?.length ?? 0}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse bg-primary-50/50 dark:bg-white/5" />)}
        </div>
      ) : !bills?.length ? (
        <EmptyState
          icon={RefreshCcw}
          title="Nenhuma conta recorrente ainda"
          description="Cadastre assinaturas e contas fixas (Canva, Adobe, aluguel, internet) para que sejam lançadas automaticamente no Financeiro quando vencerem."
          action={{ label: '+ Nova conta recorrente', onClick: () => setShowModal(true) }}
        />
      ) : (
        <div className="space-y-2">
          {bills.map(b => {
            const due = new Date(b.next_due_date + 'T00:00:00')
            const daysUntil = differenceInDays(due, new Date())
            const cc = costCenters?.find(c => c.id === b.cost_center_id)
            return (
              <div key={b.id} className="card p-4 flex items-center gap-3.5 group">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: cc ? `${cc.color}1A` : 'rgba(139,108,79,0.08)' }}
                >
                  {cc?.icon ?? '🔁'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary dark:text-stone-100 leading-snug break-words">{b.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary-50 dark:bg-primary/10 text-primary">
                      {PERIODICITY_LABELS[b.periodicity]}
                    </span>
                    <span className={clsx(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1',
                      daysUntil <= 3
                        ? 'bg-error-light dark:bg-error/10 text-error-dark dark:text-error'
                        : daysUntil <= 7
                          ? 'bg-warning-light dark:bg-warning/10 text-warning-dark dark:text-warning'
                          : 'bg-stone-100 dark:bg-stone-800 text-text-muted'
                    )}>
                      <Calendar size={9} />
                      {daysUntil < 0 ? 'Vencida' : daysUntil === 0 ? 'Vence hoje' : `Vence em ${daysUntil}d`}
                      {' · '}{format(due, 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-primary">{formatCurrency(b.amount)}</p>
                  <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                    <button onClick={() => openEdit(b)} className="p-1 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => setDeleteId(b.id)} className="p-1 rounded-lg text-text-muted hover:text-error hover:bg-error-light">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal Criar/Editar ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-md animate-scaleIn max-h-[85vh] overflow-y-auto">
            <div className="p-5 pb-3 border-b border-border dark:border-border-dark flex items-center justify-between sticky top-0 bg-white dark:bg-surface-dark">
              <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                {editing ? 'Editar conta recorrente' : 'Nova conta recorrente'}
              </h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Nome</label>
                <input className="input" placeholder="Ex: Canva, Aluguel, Internet" {...register('name')} />
                {errors.name && <p className="mt-1 text-xs text-error">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Valor</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-muted font-medium">R$</span>
                    <input type="number" step="0.01" min="0" className="input pl-9" placeholder="0,00" {...register('amount')} />
                  </div>
                  {errors.amount && <p className="mt-1 text-xs text-error">{errors.amount.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Periodicidade</label>
                  <select className="input" {...register('periodicity')}>
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quinzenal</option>
                    <option value="monthly">Mensal</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Próximo vencimento</label>
                <input type="date" className="input" {...register('next_due_date')} />
                {errors.next_due_date && <p className="mt-1 text-xs text-error">{errors.next_due_date.message}</p>}
              </div>

              {(costCenters?.length ?? 0) > 0 && (
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Centro de custo <span className="text-text-muted font-normal">(opcional)</span>
                  </label>
                  <select className="input" {...register('cost_center_id')}>
                    <option value="">Nenhum</option>
                    {costCenters?.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                  Observações <span className="text-text-muted font-normal">(opcional)</span>
                </label>
                <textarea className="input min-h-[60px] resize-none" placeholder="Detalhes adicionais..." {...register('notes')} />
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-info-light dark:bg-info/10 border border-info/20">
                <Zap size={13} className="text-info flex-shrink-0" />
                <p className="text-xs text-info-dark dark:text-info">
                  Quando a data chegar, uma conta a pagar será criada automaticamente no Financeiro.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saveMutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal confirmação delete ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm p-5 animate-scaleIn">
            <p className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-1">Remover conta recorrente?</p>
            <p className="text-xs text-text-muted dark:text-stone-400 mb-4">
              Os lançamentos já gerados no Financeiro continuam no histórico. Apenas a recorrência futura é interrompida.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-error hover:bg-error-dark transition-colors disabled:opacity-60"
              >
                {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   ABA: FLUXO DE CAIXA
═══════════════════════════════════════════════════════════ */
type PeriodFilter = 'day' | 'week' | 'month' | 'year' | 'custom'

function FluxoCaixaTab({
  companyId, supabase,
}: {
  companyId: string | null
  supabase: ReturnType<typeof createClient>
}) {
  const [period, setPeriod] = useState<PeriodFilter>('month')
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [customEnd,   setCustomEnd]   = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  /* ── Calcular intervalo de datas conforme filtro ── */
  const { rangeStart, rangeEnd } = (() => {
    const now = new Date()
    switch (period) {
      case 'day':    return { rangeStart: startOfDay(now), rangeEnd: endOfDay(now) }
      case 'week':    return { rangeStart: startOfWeek(now, { locale: ptBR }), rangeEnd: endOfWeek(now, { locale: ptBR }) }
      case 'year':    return { rangeStart: startOfYear(now), rangeEnd: endOfYear(now) }
      case 'custom':  return { rangeStart: startOfDay(new Date(customStart + 'T00:00:00')), rangeEnd: endOfDay(new Date(customEnd + 'T00:00:00')) }
      default:        return { rangeStart: startOfMonth(now), rangeEnd: endOfMonth(now) }
    }
  })()

  const rangeStartStr = format(rangeStart, 'yyyy-MM-dd')
  const rangeEndStr   = format(rangeEnd, 'yyyy-MM-dd')

  /* ── Query: todas as transações relevantes (até o fim do período) ──
     Caixa real considera apenas o que foi efetivamente movimentado:
     receitas com status 'received' e despesas com status 'paid'. */
  const { data: allTx, isLoading } = useQuery({
    queryKey: ['fluxo-caixa', companyId, rangeEndStr],
    enabled:  !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('financial_transactions') as any)
        .select('type, amount, date, status, description, category')
        .eq('company_id', companyId!)
        .in('status', ['received', 'paid'])
        .lte('date', rangeEndStr)
        .order('date')
      if (error) throw error
      return data ?? []
    },
  })

  const txs = allTx ?? []

  /* ── Saldo inicial: tudo movimentado ANTES do início do período ── */
  const saldoInicial = txs
    .filter((t: any) => t.date < rangeStartStr)
    .reduce((s: number, t: any) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0)

  /* ── Movimentação DENTRO do período ── */
  const txsNoPeriodo = txs.filter((t: any) => t.date >= rangeStartStr && t.date <= rangeEndStr)
  const entradas = txsNoPeriodo.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount), 0)
  const saidas   = txsNoPeriodo.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount), 0)
  const saldoFinal = saldoInicial + entradas - saidas

  /* ── Série diária para o gráfico (saldo acumulado dia a dia) ── */
  const chartData = (() => {
    if (rangeStart > rangeEnd) return []
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
    let running = saldoInicial
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd')
      const dayTxs = txsNoPeriodo.filter((t: any) => t.date === dayStr)
      const dayIn  = dayTxs.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount), 0)
      const dayOut = dayTxs.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount), 0)
      running += dayIn - dayOut
      return {
        date: format(day, days.length > 31 ? 'MMM' : 'dd/MM', { locale: ptBR }),
        saldo: Math.round(running * 100) / 100,
      }
    })
  })()

  /* ── Lista de movimentos do período, mais recentes primeiro ── */
  const movimentos = [...txsNoPeriodo].sort((a: any, b: any) => b.date.localeCompare(a.date))

  const periodLabel =
    period === 'day'    ? 'Hoje' :
    period === 'week'    ? 'Esta semana' :
    period === 'year'    ? 'Este ano' :
    period === 'custom'  ? `${format(rangeStart, 'dd/MM/yyyy')} – ${format(rangeEnd, 'dd/MM/yyyy')}` :
    'Este mês'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-text-primary dark:text-stone-100">Fluxo de Caixa</p>
          <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">
            Entradas, saídas e saldo real — considera apenas valores já recebidos/pagos
          </p>
        </div>
      </div>

      {/* ── Filtros de período ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {([
          { id: 'day', label: 'Dia' },
          { id: 'week', label: 'Semana' },
          { id: 'month', label: 'Mês' },
          { id: 'year', label: 'Ano' },
          { id: 'custom', label: 'Personalizado' },
        ] as { id: PeriodFilter; label: string }[]).map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={clsx(
              'px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex-shrink-0',
              period === p.id
                ? 'bg-primary text-white shadow-btn'
                : 'bg-white dark:bg-surface-dark border border-border dark:border-border-dark text-text-secondary dark:text-stone-400 hover:border-primary/40'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="card flex items-center gap-3 p-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-muted dark:text-stone-400">De</label>
            <input type="date" className="input py-1.5 text-sm" value={customStart} onChange={e => setCustomStart(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-muted dark:text-stone-400">Até</label>
            <input type="date" className="input py-1.5 text-sm" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="card h-20 animate-pulse bg-primary-50/50 dark:bg-white/5" />)}
        </div>
      ) : (
        <>
          {/* ── Cards resumo ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card p-4">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Saldo inicial</p>
              <p className="text-lg font-bold text-text-primary dark:text-stone-100 mt-1">{formatCurrency(saldoInicial)}</p>
              <p className="text-[10px] text-text-muted mt-0.5">antes de {periodLabel.toLowerCase()}</p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Entradas</p>
              <p className="text-lg font-bold text-success mt-1">+{formatCurrency(entradas)}</p>
              <p className="text-[10px] text-text-muted mt-0.5">{periodLabel}</p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Saídas</p>
              <p className="text-lg font-bold text-error mt-1">−{formatCurrency(saidas)}</p>
              <p className="text-[10px] text-text-muted mt-0.5">{periodLabel}</p>
            </div>
            <div className="card p-4 border-2 border-primary/30">
              <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Saldo final</p>
              <p className={clsx('text-lg font-bold mt-1', saldoFinal >= 0 ? 'text-primary' : 'text-error')}>
                {formatCurrency(saldoFinal)}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">em {format(rangeEnd, 'dd/MM/yyyy')}</p>
            </div>
          </div>

          {/* ── Gráfico de evolução do saldo ── */}
          {chartData.length > 0 && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-text-secondary dark:text-stone-400 mb-3">Evolução do saldo no período</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B6C4F" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#8B6C4F" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#8B6C4F" strokeOpacity={0.08} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={70}
                    tickFormatter={(v) => formatCurrency(v).replace('R$', '').trim()} />
                  <Tooltip
                    formatter={(v: number) => [formatCurrency(v), 'Saldo']}
                    contentStyle={{ borderRadius: 12, border: '1px solid rgba(139,108,79,0.2)', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="saldo" stroke="#8B6C4F" strokeWidth={2} fill="url(#saldoGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Lista de movimentos ── */}
          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-border dark:border-border-dark">
              <p className="text-xs font-semibold text-text-secondary dark:text-stone-400">
                Movimentos no período ({movimentos.length})
              </p>
            </div>
            {movimentos.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-text-muted dark:text-stone-400">Nenhuma movimentação neste período.</p>
              </div>
            ) : (
              <div className="divide-y divide-border dark:divide-border-dark max-h-96 overflow-y-auto">
                {movimentos.map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={clsx(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        t.type === 'income' ? 'bg-success-light dark:bg-success/10' : 'bg-error-light dark:bg-error/10'
                      )}>
                        {t.type === 'income'
                          ? <TrendingUp size={14} className="text-success" />
                          : <TrendingUp size={14} className="text-error rotate-180" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-text-primary dark:text-stone-100 leading-snug break-words">{t.description || 'Sem descrição'}</p>
                        <p className="text-[10px] text-text-muted dark:text-stone-500">{format(new Date(t.date + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                      </div>
                    </div>
                    <span className={clsx('text-sm font-bold flex-shrink-0', t.type === 'income' ? 'text-success' : 'text-error')}>
                      {t.type === 'income' ? '+' : '−'}{formatCurrency(Number(t.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
