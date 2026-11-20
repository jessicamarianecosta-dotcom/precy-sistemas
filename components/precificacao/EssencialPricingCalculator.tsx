'use client'

/**
 * Calculadora de Precificação do plano Essencial.
 *
 * Genérica para qualquer segmento (revenda, produção ou serviço), com
 * custos indiretos cadastrados aqui mesmo e rateados por horas produtivas
 * ou por quantidade estimada de vendas — ver prompt mestre do Precy
 * Essencial, módulo 2. Componente isolado do calculador do Pro
 * (app/(dashboard)/precificacao/page.tsx): nenhuma lógica é compartilhada,
 * então nada aqui pode regredir o comportamento do Pro.
 */

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import {
  Calculator, ShoppingBag, Hammer, Wrench, Plus, Trash2, Layers,
  CheckCircle, Loader2, Clock, Hash, Percent, DollarSign, Tag,
  AlertTriangle, PackagePlus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/hooks/useCompanyId'
import { useToast } from '@/components/ui/Toaster'
import { Header } from '@/components/layout/Header'
import { formatCurrency as fmt, formatPercent } from '@/lib/utils/format'

/* ─────────────────────────── Types ─── */
type ActivityType = 'resale' | 'produced' | 'service'
type RateioMode    = 'hours' | 'sales_qty'
type PricingMode   = 'percent' | 'manual_profit' | 'manual_price'

interface CostItem { id: string; name: string; value: number }
interface FixedCostRow { id: string; name: string; amount: number; is_active: boolean }

const ACTIVITY_TYPES: { value: ActivityType; label: string; sub: string; icon: any }[] = [
  { value: 'produced', label: 'Produto produzido', sub: 'Você fabrica',          icon: Hammer      },
  { value: 'resale',   label: 'Produto para revenda', sub: 'Compra e revende',  icon: ShoppingBag },
  { value: 'service',  label: 'Serviço',             sub: 'Você presta um serviço', icon: Wrench  },
]

function newItem(): CostItem {
  return { id: crypto.randomUUID(), name: '', value: 0 }
}

/* ─────────────────────────── Component ─── */
export function EssencialPricingCalculator() {
  const supabase     = createClient()
  const queryClient   = useQueryClient()
  const { toast }      = useToast()
  const { companyId }  = useCompanyId()

  /* ── Tipo de atividade ── */
  const [activityType, setActivityType] = useState<ActivityType>('produced')

  /* ── Custos diretos ── */
  const [directItems, setDirectItems] = useState<CostItem[]>([newItem()])
  const [laborCost,    setLaborCost]    = useState(0)
  const [packagingCost, setPackagingCost] = useState(0)

  /* ── Rateio de custos indiretos ── */
  const [rateioMode,      setRateioMode]      = useState<RateioMode>('hours')
  const [productiveHours, setProductiveHours] = useState(160)
  const [estimatedSales,  setEstimatedSales]  = useState(0)
  const [hoursUsed,       setHoursUsed]       = useState(1)
  const [newFixedCost,    setNewFixedCost]    = useState({ name: '', amount: 0 })

  /* ── Precificação ── */
  const [pricingMode,   setPricingMode]   = useState<PricingMode>('percent')
  const [marginPercent, setMarginPercent] = useState(30)
  const [manualProfit,  setManualProfit]  = useState(0)
  const [manualPrice,   setManualPrice]   = useState(0)

  const [productName, setProductName] = useState('')
  const [savedOk, setSavedOk] = useState(false)

  /* ── company (horas produtivas / vendas estimadas / modo de rateio) ── */
  const { data: company } = useQuery({
    queryKey: ['company-essencial-pricing', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data } = await (supabase.from('companies') as any)
        .select('work_hours_per_month, essencial_rateio_mode, estimated_monthly_sales')
        .eq('id', companyId!).maybeSingle()
      return data
    },
  })

  useEffect(() => {
    if (!company) return
    if (company.work_hours_per_month != null) setProductiveHours(Number(company.work_hours_per_month))
    if (company.essencial_rateio_mode) setRateioMode(company.essencial_rateio_mode)
    if (company.estimated_monthly_sales != null) setEstimatedSales(Number(company.estimated_monthly_sales))
  }, [company])

  const saveRateioMutation = useMutation({
    mutationFn: async (patch: { essencial_rateio_mode?: RateioMode; work_hours_per_month?: number; estimated_monthly_sales?: number }) => {
      if (!companyId) return
      await (supabase.from('companies') as any).update(patch).eq('id', companyId)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company-essencial-pricing', companyId] }),
  })

  /* ── custos indiretos (fixed_costs — mesma tabela usada em Configurações) ── */
  const { data: fixedCosts } = useQuery<FixedCostRow[]>({
    queryKey: ['fixed_costs-essencial', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data } = await (supabase.from('fixed_costs') as any)
        .select('id, name, amount, is_active')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: true })
      return (data ?? []) as FixedCostRow[]
    },
  })

  const addFixedCostMutation = useMutation({
    mutationFn: async (draft: { name: string; amount: number }) => {
      await (supabase.from('fixed_costs') as any).insert([{ company_id: companyId, ...draft, category: 'geral' }])
    },
    onSuccess: () => {
      setNewFixedCost({ name: '', amount: 0 })
      queryClient.invalidateQueries({ queryKey: ['fixed_costs-essencial', companyId] })
    },
  })

  const toggleFixedCostMutation = useMutation({
    mutationFn: async (row: FixedCostRow) => {
      await (supabase.from('fixed_costs') as any).update({ is_active: !row.is_active }).eq('id', row.id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fixed_costs-essencial', companyId] }),
  })

  const deleteFixedCostMutation = useMutation({
    mutationFn: async (id: string) => {
      await (supabase.from('fixed_costs') as any).delete().eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fixed_costs-essencial', companyId] }),
  })

  /* ── Cálculos ── */
  const directTotal =
    directItems.reduce((s, i) => s + (Number(i.value) || 0), 0) +
    (activityType !== 'resale' ? Number(laborCost) || 0 : 0) +
    (activityType === 'produced' ? Number(packagingCost) || 0 : 0)

  const fixedCostsTotal = (fixedCosts ?? []).filter(c => c.is_active).reduce((s, c) => s + Number(c.amount), 0)
  const hasIndirectData = rateioMode === 'hours' ? productiveHours > 0 : estimatedSales > 0
  const indirectAllocated = fixedCostsTotal <= 0 || !hasIndirectData
    ? 0
    : rateioMode === 'hours'
      ? (fixedCostsTotal / productiveHours) * (Number(hoursUsed) || 0)
      : fixedCostsTotal / estimatedSales

  const costTotal = directTotal + indirectAllocated

  let price = 0
  if (pricingMode === 'percent') {
    const m = Math.min(Math.max(Number(marginPercent) || 0, 0), 99)
    price = costTotal > 0 ? costTotal / (1 - m / 100) : 0
  } else if (pricingMode === 'manual_profit') {
    price = costTotal + (Number(manualProfit) || 0)
  } else {
    price = Number(manualPrice) || 0
  }
  const profit = price - costTotal
  const profitPercent = price > 0 ? (profit / price) * 100 : 0
  // markup_percentage no banco é acréscimo-sobre-custo (mesma semântica usada
  // no resto do sistema, inclusive no simulador de preços de Produtos) — não
  // é a margem/lucro % que este módulo mostra ao usuário.
  const markupStored = costTotal > 0 ? (profit / costTotal) * 100 : 0

  const canCalculate = directTotal > 0 || fixedCostsTotal > 0
  const incompleteIndirect = fixedCostsTotal <= 0

  /* ── Salvar como produto ── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !productName.trim()) throw new Error('Informe um nome para o produto ou serviço.')
      if (!(price > 0)) throw new Error('Informe os custos e o lucro/preço para calcular um valor maior que zero.')

      const extraCostsList: { id: string; name: string; value: number; calc_type: 'fixed' }[] = []
      if (activityType === 'produced' && packagingCost > 0) {
        extraCostsList.push({ id: crypto.randomUUID(), name: 'Embalagem', value: packagingCost, calc_type: 'fixed' })
      }
      if (indirectAllocated > 0) {
        extraCostsList.push({ id: crypto.randomUUID(), name: 'Custos indiretos (rateio)', value: indirectAllocated, calc_type: 'fixed' })
      }

      const { data: product, error } = await (supabase.from('products') as any)
        .insert([{
          company_id:    companyId,
          name:          productName.trim(),
          category:      'geral',
          unit:          'un',
          product_type:  activityType,
          purchase_cost: activityType === 'resale' ? directTotal - laborCost - packagingCost : 0,
          material_cost: activityType === 'produced' ? directItems.reduce((s, i) => s + (Number(i.value) || 0), 0) : 0,
          labor_cost:    activityType !== 'resale' ? laborCost : 0,
          extra_cost:    extraCostsList.reduce((s, i) => s + i.value, 0),
          extra_costs:   extraCostsList,
          markup_percentage: Number(markupStored.toFixed(2)),
          total_cost:    costTotal,
          final_price:   price,
        }])
        .select('id').single()
      if (error) throw error

      if (activityType === 'produced') {
        const rows = directItems
          .filter(i => i.name.trim() && i.value > 0)
          .map(i => ({
            company_id:    companyId,
            product_id:    product.id,
            inventory_id:  null,
            material_name: i.name.trim(),
            quantity:      1,
            unit:          'un',
            unit_cost:     i.value,
            subtotal:      i.value,
          }))
        if (rows.length > 0) await (supabase.from('product_materials') as any).insert(rows)
      }
      return product
    },
    onSuccess: () => {
      setSavedOk(true)
      toast('success', 'Produto criado a partir do cálculo!')
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (err: any) => toast('error', err.message || 'Não foi possível salvar.'),
  })

  function resetForm() {
    setDirectItems([newItem()])
    setLaborCost(0)
    setPackagingCost(0)
    setHoursUsed(1)
    setPricingMode('percent')
    setMarginPercent(30)
    setManualProfit(0)
    setManualPrice(0)
    setProductName('')
    setSavedOk(false)
  }

  /* ── Helpers de UI ── */
  function updateDirectItem(id: string, patch: Partial<CostItem>) {
    setDirectItems(items => items.map(i => (i.id === id ? { ...i, ...patch } : i)))
  }
  function removeDirectItem(id: string) {
    setDirectItems(items => (items.length > 1 ? items.filter(i => i.id !== id) : items))
  }

  const directLabel =
    activityType === 'resale' ? 'Custo de aquisição e outros custos'
    : activityType === 'produced' ? 'Materiais e outros custos diretos'
    : 'Custos diretos do serviço'

  return (
    <div className="page-enter">
      <Header title="Precificação" subtitle="Calcule o preço ideal considerando custos diretos e indiretos" />

      <div className="p-4 sm:p-6 space-y-5 max-w-3xl">
        {/* ── 1. Tipo de atividade ── */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary/10">
              <Tag size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Tipo de atividade</h2>
              <p className="text-xs text-text-muted dark:text-stone-400">Os campos abaixo se adaptam à sua escolha</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {ACTIVITY_TYPES.map(opt => {
              const Icon = opt.icon
              const active = activityType === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setActivityType(opt.value)}
                  className={clsx(
                    'flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 text-left transition-all duration-200',
                    active ? 'border-primary bg-primary-50 dark:bg-primary/10' : 'border-border dark:border-border-dark hover:border-primary/40'
                  )}
                >
                  <div className={clsx('p-1.5 rounded-lg', active ? 'bg-primary text-white' : 'bg-primary-50 dark:bg-primary/10 text-primary')}>
                    <Icon size={14} />
                  </div>
                  <p className={clsx('text-xs font-semibold leading-snug', active ? 'text-primary' : 'text-text-primary dark:text-stone-100')}>{opt.label}</p>
                  <p className="text-[10px] text-text-muted dark:text-stone-400 leading-tight">{opt.sub}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 2. Custos diretos ── */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary/10">
              <DollarSign size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Custos diretos</h2>
              <p className="text-xs text-text-muted dark:text-stone-400">{directLabel}</p>
            </div>
          </div>

          <div className="space-y-2">
            {directItems.map(item => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  type="text" placeholder="Ex: Tecido, custo de aquisição, frete…"
                  value={item.name} onChange={e => updateDirectItem(item.id, { name: e.target.value })}
                  className="input flex-1 text-sm"
                />
                <input
                  type="number" step="0.01" placeholder="R$ 0,00"
                  value={item.value || ''} onChange={e => updateDirectItem(item.id, { value: Number(e.target.value) || 0 })}
                  className="input w-28 text-sm"
                />
                <button type="button" onClick={() => removeDirectItem(item.id)} className="p-2 text-text-muted hover:text-error transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDirectItems(items => [...items, newItem()])}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-dark transition-colors"
          >
            <Plus size={14} /> Adicionar item
          </button>

          {activityType !== 'resale' && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border dark:border-border-dark">
              <div>
                <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Mão de obra (R$)</label>
                <input type="number" step="0.01" value={laborCost || ''} onChange={e => setLaborCost(Number(e.target.value) || 0)} className="input text-sm" placeholder="0,00" />
              </div>
              {activityType === 'produced' && (
                <div>
                  <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Embalagem (R$)</label>
                  <input type="number" step="0.01" value={packagingCost || ''} onChange={e => setPackagingCost(Number(e.target.value) || 0)} className="input text-sm" placeholder="0,00" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 3. Custos indiretos ── */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary/10">
              <Layers size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Custos indiretos (despesas mensais)</h2>
              <p className="text-xs text-text-muted dark:text-stone-400">Aluguel, energia, internet, sistemas… cadastre uma vez e reaproveite</p>
            </div>
          </div>

          <div className="space-y-1.5">
            {(fixedCosts ?? []).map(row => (
              <div key={row.id} className={clsx('flex items-center gap-2 text-sm', !row.is_active && 'opacity-50')}>
                <button type="button" onClick={() => toggleFixedCostMutation.mutate(row)} title={row.is_active ? 'Desativar' : 'Ativar'}>
                  <CheckCircle size={14} className={row.is_active ? 'text-success' : 'text-text-muted'} />
                </button>
                <span className="flex-1 truncate">{row.name}</span>
                <span className="font-semibold">{fmt(row.amount)}</span>
                <button type="button" onClick={() => deleteFixedCostMutation.mutate(row.id)} className="p-1 text-text-muted hover:text-error transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text" placeholder="Ex: Aluguel, energia…"
              value={newFixedCost.name} onChange={e => setNewFixedCost(d => ({ ...d, name: e.target.value }))}
              className="input flex-1 text-sm"
            />
            <input
              type="number" step="0.01" placeholder="R$ 0,00"
              value={newFixedCost.amount || ''} onChange={e => setNewFixedCost(d => ({ ...d, amount: Number(e.target.value) || 0 }))}
              className="input w-28 text-sm"
            />
            <button
              type="button"
              disabled={!newFixedCost.name.trim() || newFixedCost.amount <= 0}
              onClick={() => addFixedCostMutation.mutate(newFixedCost)}
              className="btn btn-secondary px-3 py-2 text-sm disabled:opacity-40"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="pt-2 border-t border-border dark:border-border-dark space-y-3">
            <p className="text-xs font-semibold text-text-primary dark:text-stone-100">Como ratear esses custos?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setRateioMode('hours'); saveRateioMutation.mutate({ essencial_rateio_mode: 'hours' }) }}
                className={clsx('flex items-center gap-2 p-2.5 rounded-xl border-2 text-left text-xs font-medium transition-all',
                  rateioMode === 'hours' ? 'border-primary bg-primary-50 dark:bg-primary/10 text-primary' : 'border-border dark:border-border-dark')}
              >
                <Clock size={14} /> Por horas produtivas
              </button>
              <button
                type="button"
                onClick={() => { setRateioMode('sales_qty'); saveRateioMutation.mutate({ essencial_rateio_mode: 'sales_qty' }) }}
                className={clsx('flex items-center gap-2 p-2.5 rounded-xl border-2 text-left text-xs font-medium transition-all',
                  rateioMode === 'sales_qty' ? 'border-primary bg-primary-50 dark:bg-primary/10 text-primary' : 'border-border dark:border-border-dark')}
              >
                <Hash size={14} /> Por qtde. estimada de vendas
              </button>
            </div>

            {rateioMode === 'hours' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Horas produtivas no mês</label>
                  <input
                    type="number" value={productiveHours || ''}
                    onChange={e => { const v = Number(e.target.value) || 0; setProductiveHours(v); saveRateioMutation.mutate({ work_hours_per_month: v }) }}
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Horas usadas neste item</label>
                  <input type="number" step="0.1" value={hoursUsed || ''} onChange={e => setHoursUsed(Number(e.target.value) || 0)} className="input text-sm" />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Qtde. estimada de vendas no mês</label>
                <input
                  type="number" value={estimatedSales || ''}
                  onChange={e => { const v = Number(e.target.value) || 0; setEstimatedSales(v); saveRateioMutation.mutate({ estimated_monthly_sales: v }) }}
                  className="input text-sm"
                />
              </div>
            )}

            {incompleteIndirect && (
              <p className="flex items-center gap-1.5 text-[11px] text-warning-dark bg-warning-light dark:bg-warning/10 rounded-lg px-2.5 py-1.5">
                <AlertTriangle size={12} className="flex-shrink-0" />
                Nenhuma despesa indireta cadastrada ainda — o resultado abaixo não vai considerar esses custos.
              </p>
            )}
            {!incompleteIndirect && !hasIndirectData && (
              <p className="flex items-center gap-1.5 text-[11px] text-warning-dark bg-warning-light dark:bg-warning/10 rounded-lg px-2.5 py-1.5">
                <AlertTriangle size={12} className="flex-shrink-0" />
                {rateioMode === 'hours' ? 'Informe as horas produtivas do mês' : 'Informe a quantidade estimada de vendas'} para ratear esses custos.
              </p>
            )}
          </div>
        </div>

        {/* ── 4. Lucro e preço de venda ── */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary/10">
              <Percent size={16} className="text-primary" />
            </div>
            <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Lucro e preço de venda</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { value: 'percent' as PricingMode,       label: 'Lucro por %' },
              { value: 'manual_profit' as PricingMode, label: 'Lucro manual (R$)' },
              { value: 'manual_price' as PricingMode,  label: 'Preço de venda manual' },
            ].map(opt => (
              <button
                key={opt.value} type="button" onClick={() => setPricingMode(opt.value)}
                className={clsx('p-2.5 rounded-xl border-2 text-xs font-medium transition-all',
                  pricingMode === opt.value ? 'border-primary bg-primary-50 dark:bg-primary/10 text-primary' : 'border-border dark:border-border-dark')}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {pricingMode === 'percent' && (
            <div>
              <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Lucro desejado (% sobre o preço de venda)</label>
              <input type="number" min={0} max={99} value={marginPercent} onChange={e => setMarginPercent(Number(e.target.value) || 0)} className="input text-sm" />
            </div>
          )}
          {pricingMode === 'manual_profit' && (
            <div>
              <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Lucro desejado (R$)</label>
              <input type="number" step="0.01" value={manualProfit || ''} onChange={e => setManualProfit(Number(e.target.value) || 0)} className="input text-sm" />
            </div>
          )}
          {pricingMode === 'manual_price' && (
            <div>
              <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Preço de venda (R$)</label>
              <input type="number" step="0.01" value={manualPrice || ''} onChange={e => setManualPrice(Number(e.target.value) || 0)} className="input text-sm" />
            </div>
          )}
        </div>

        {/* ── 5. Resultado ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card bg-primary-50/60 dark:bg-primary/5 border-primary/20 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Calculator size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Resultado</h2>
          </div>
          <ResultRow label="Custos diretos" value={directTotal} />
          <ResultRow label="Custos indiretos rateados" value={indirectAllocated} />
          <ResultRow label="Custo total" value={costTotal} strong />
          <ResultRow label="Lucro" value={profit} sub={formatPercent(profitPercent)} />
          <div className="pt-2 mt-1 border-t border-primary/20 flex items-center justify-between">
            <span className="text-sm font-semibold text-text-primary dark:text-stone-100">Preço de venda {pricingMode === 'manual_price' ? '(informado)' : 'sugerido'}</span>
            <span className="text-xl font-bold text-primary">{fmt(price)}</span>
          </div>
        </motion.div>

        {/* ── 6. Salvar ── */}
        <div className="card space-y-3">
          {savedOk ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-success-light dark:bg-success/10">
              <CheckCircle size={20} className="text-success flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-success-dark">Produto criado!</p>
                <p className="text-xs text-text-muted">Você já pode usá-lo em Pedidos, Orçamentos e na Vitrine Virtual.</p>
              </div>
              <button type="button" onClick={resetForm} className="btn btn-secondary text-xs px-3 py-2 flex-shrink-0">Novo cálculo</button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Nome do produto ou serviço</label>
                <input type="text" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Ex: Bolo de chocolate, Corte de cabelo…" className="input text-sm" />
              </div>
              <button
                type="button"
                disabled={!canCalculate || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <PackagePlus size={16} />}
                Salvar e transformar em produto
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultRow({ label, value, sub, strong }: { label: string; value: number; sub?: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={clsx('text-text-secondary dark:text-stone-300', strong && 'font-semibold text-text-primary dark:text-stone-100')}>{label}</span>
      <span className={clsx(strong && 'font-semibold')}>
        {fmt(value)}
        {sub && <span className="text-text-muted text-xs ml-1.5">({sub})</span>}
      </span>
    </div>
  )
}
