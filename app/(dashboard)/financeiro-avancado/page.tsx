'use client'

import { useState } from 'react'
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
  Award, ChevronRight, Sparkles, CheckCircle,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

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
    { id: 'recorrentes',    label: 'Contas Recorrentes', icon: RefreshCcw,  ready: false },
    { id: 'fluxo_caixa',    label: 'Fluxo de Caixa',     icon: LineChart,   ready: false },
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
        {tab !== 'visao_geral' && tab !== 'centro_custos' && (
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
    { id: 'recorrentes',   title: 'Contas Recorrentes', desc: 'Assinaturas e contas fixas geradas automaticamente',  icon: RefreshCcw, ready: false },
    { id: 'fluxo_caixa',   title: 'Fluxo de Caixa',     desc: 'Entradas, saídas e saldo em qualquer período',        icon: LineChart,  ready: false },
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
