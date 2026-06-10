'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import {
  Calculator, TrendingUp, Plus, X, Package, Ruler,
  Save, CheckCircle, Loader2, AlertTriangle,
  ShoppingBag, Hammer, ChevronRight,
  ArrowRight, Info,
} from 'lucide-react'
import { clsx } from 'clsx'

/* ─────────────────────────── Types ─── */
type ProductType = 'produced' | 'resale' | 'meter_product'

interface InventoryItem {
  id: string
  name: string
  unit: string
  quantity: number
  cost_per_unit: number
  category: string
  status: string
}

interface MaterialLine {
  tmpId:        string
  inventory_id: string
  name:         string
  unit:         string
  stock:        number
  cost_per_unit: number
  quantity:     number
  subtotal:     number
}

/* ─────────────────────────── Helpers ─── */
function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

/* ─────────────────────────── Slider ─── */
function MarginSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const pct = Math.min(100, ((value - 10) / (500 - 10)) * 100)
  const color = value < 50 ? '#C4503A' : value < 100 ? '#C4893A' : value < 200 ? '#5C8B4F' : '#8B6C4F'

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-text-primary dark:text-stone-200">
          Margem de Lucro
        </label>
        <span className="text-sm font-bold px-2.5 py-1 rounded-lg" style={{ background: `${color}18`, color }}>
          {value}%
        </span>
      </div>
      <div className="relative h-6 flex items-center">
        {/* Track */}
        <div className="absolute w-full h-2 rounded-full bg-border dark:bg-border-dark overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-150"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, #C4503A, #C4893A 25%, #5C8B4F 55%, #8B6C4F)` }}
          />
        </div>
        <input
          type="range"
          min={10} max={500} step={5}
          value={value}
          onChange={e => onChange(parseInt(e.target.value))}
          className="relative w-full h-2 opacity-0 cursor-pointer z-10"
        />
        {/* Thumb */}
        <div
          className="absolute w-5 h-5 rounded-full border-2 border-white shadow-md pointer-events-none transition-all duration-150"
          style={{ left: `calc(${pct}% - 10px)`, background: color }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-text-muted mt-1.5">
        <span>10% — baixo</span>
        <span>100% — saudável</span>
        <span>500% — premium</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════ PAGE ═══ */
export default function PrecificacaoPage() {
  const supabase    = createClient()
  const queryClient = useQueryClient()

  const [companyId, setCompanyId] = useState<string | null>(null)

  /* ── form state ── */
  const [productType,      setProductType]      = useState<ProductType>('produced')
  const [productName,      setProductName]      = useState('')
  const [category,         setCategory]         = useState('geral')
  const [unit,             setUnit]             = useState('un')
  const [markup,           setMarkup]           = useState(100)
  const [productionHours,  setProductionHours]  = useState(1)
  const [purchaseCost,     setPurchaseCost]     = useState(0)
  const [extraCosts, setExtraCosts] = useState<
    {
      id: string
      name: string
      value: number
    }[]
  >([
    {
      id: crypto.randomUUID(),
      name: '',
      value: 0,
    },
  ])
  const [materials,        setMaterials]        = useState<MaterialLine[]>([])

  /* ── ui state ── */
  const [showPicker,  setShowPicker]  = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [savedOk,     setSavedOk]     = useState(false)

  /* ── load company ── */
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const res: any = await supabase.from('companies').select('id').eq('user_id', user.id).single()
      if (res?.data?.id) setCompanyId(res.data.id)
    }
    load()
  }, [])

  /* ── Queries ── */
  const { data: company } = useQuery({
    queryKey: ['company-pricing', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      const res: any = await supabase.from('companies')
        .select('fixed_costs, work_hours_per_month').eq('id', companyId!).single()
      return res?.data
    },
  })

  const { data: inventoryItems } = useQuery<InventoryItem[]>({
    queryKey: ['inventory-picker', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data } = await supabase.from('inventory')
        .select('id, name, unit, quantity, cost_per_unit, category, status')
        .eq('company_id', companyId!)
        .order('name')
      return (data as InventoryItem[]) ?? []
    },
  })

  /* ── Calculated values ── */
  const fixedCosts   = Number((company as any)?.fixed_costs ?? 0)
  const workHours    = Number((company as any)?.work_hours_per_month ?? 160)
  const hourlyRate   = workHours > 0 ? fixedCosts / workHours : 0
  const laborCost    = productType === 'produced' ? hourlyRate * productionHours : 0
  const materialCost = materials.reduce((s, m) => s + m.subtotal, 0)

  const extraCost = extraCosts.reduce(
    (acc, item) => acc + Number(item.value || 0),
    0
  )

  // ── Cálculos para Produto por metro ──
  const mAreaM2 = productType === 'meter_product'
    ? (mUnit === 'cm'
        ? (mWidth / 100) * (mHeight / 100)
        : mWidth * mHeight)
    : 0
  const mAreaCm2 = productType === 'meter_product'
    ? (mUnit === 'cm'
        ? mWidth * mHeight
        : mWidth * 100 * mHeight * 100)
    : 0
  const mMaterialCost = productType === 'meter_product'
    ? mAreaM2 * pricePerM2
    : 0
  const pricePerCm2 = pricePerM2 > 0 ? pricePerM2 / 10000 : 0

  const baseCost     = productType === 'produced'
    ? materialCost + laborCost + extraCost
    : productType === 'meter_product'
      ? mMaterialCost + finishingCost + laborCost + extraCost
      : purchaseCost + extraCost

  const idealPrice   = baseCost > 0 ? baseCost * (1 + markup / 100) : 0
  const profit       = idealPrice - baseCost
  const margin       = idealPrice > 0 ? (profit / idealPrice) * 100 : 0

  const scenarios = useMemo(() => [
    {
      label: 'Conservador',
      sub:   'Preço competitivo, lucro menor',
      markup: Math.max(30, Math.round(markup * 0.5)),
      price:  baseCost * (1 + Math.max(30, markup * 0.5) / 100),
    },
    {
      label: 'Ideal',
      sub:   'Lucro saudável e sustentável',
      markup,
      price: idealPrice,
      active: true,
    },
    {
      label: 'Premium',
      sub:   'Posicionamento premium',
      markup: Math.round(markup * 1.6),
      price:  baseCost * (1 + (markup * 1.6) / 100),
    },
  ], [markup, baseCost, idealPrice])

  /* ── Material picker ── */
  const filteredInventory = (inventoryItems ?? []).filter(i =>
    i.name.toLowerCase().includes(pickerSearch.toLowerCase())
  )

  function addMaterial(item: InventoryItem) {
    const already = materials.find(m => m.inventory_id === item.id)
    if (already) return
    const line: MaterialLine = {
      tmpId:        Math.random().toString(36).slice(2),
      inventory_id: item.id,
      name:         item.name,
      unit:         item.unit,
      stock:        item.quantity,
      cost_per_unit: Number(item.cost_per_unit),
      quantity:     1,
      subtotal:     Number(item.cost_per_unit),
    }
    setMaterials(prev => [...prev, line])
    setShowPicker(false)
    setPickerSearch('')
  }

  function updateQty(tmpId: string, qty: number) {
    setMaterials(prev => prev.map(m =>
      m.tmpId === tmpId
        ? { ...m, quantity: qty, subtotal: qty * m.cost_per_unit }
        : m
    ))
  }

  function removeMaterial(tmpId: string) {
    setMaterials(prev => prev.filter(m => m.tmpId !== tmpId))
  }

  /* ── Save mutation ── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !productName.trim()) {
        throw new Error('Dados incompletos')
      }

      /* ─────────────────────────────
         1. SALVAR PRODUTO
      ───────────────────────────── */
      const { data: product, error: productError } = await (supabase
        .from('products') as any)
        .insert({
          company_id: companyId,

          name: productName.trim(),

          category,

          unit,

          production_time_hours:
            productType === 'produced'
              ? productionHours
              : 0,

          material_cost:
            productType === 'produced'
              ? materialCost
              : purchaseCost,

          extra_cost: extraCost,
          extra_costs: extraCosts,

          markup_percentage: markup,

          final_price: idealPrice,

          product_type: productType,

          is_active: true,
        })
        .select()
        .single()

      if (productError) {
        console.error(productError)
        throw productError
      }

      /* ─────────────────────────────
         2. SALVAR MATERIAIS UTILIZADOS
      ───────────────────────────── */
      if (
        productType === 'produced' &&
        materials.length > 0
      ) {
        const materialRows = materials.map(m => ({
          company_id: companyId,

          product_id: product.id,

          inventory_id: m.inventory_id,

          material_name: m.name,

          quantity: m.quantity,

          unit: m.unit,

          unit_cost: m.cost_per_unit,

          subtotal: m.subtotal,
        }))

        const { error: materialsError } = await (supabase
          .from('product_materials') as any)
          .insert(materialRows)

        if (materialsError) {
          console.error(materialsError)
          throw materialsError
        }
      }

      return product
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['products', companyId],
      })

      queryClient.invalidateQueries({
        queryKey: ['inventory-picker', companyId],
      })

      setSavedOk(true)

      setTimeout(() => {
        setSavedOk(false)
      }, 3000)

      setProductName('')
      setCategory('geral')
      setUnit('un')
      setMarkup(100)
      setProductionHours(1)
      setPurchaseCost(0)
      setExtraCosts([
        {
          id: crypto.randomUUID(),
          name: '',
          value: 0,
        },
      ])
      setMaterials([])
    },

    onError: error => {
      console.error(error)
    },
  })

/* ═══════════════════════════════ RENDER ═══ */
  return (
    <div className="page-enter">
      <Header title="Precificação" subtitle="Calcule o preço ideal e cadastre seu produto" />

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── Info banner quando não tem custos fixos ── */}
        {!fixedCosts && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-warning/30 bg-warning-light dark:bg-warning/10">
            <AlertTriangle size={16} className="text-warning flex-shrink-0 mt-0.5" />
            <p className="text-xs text-warning-dark">
              <strong>Configure seus custos fixos</strong> em Configurações → Custos Fixos para ter o cálculo
              de custo/hora preciso e o preço ideal dos seus produtos. 
              <a href="/configuracoes" className="underline ml-1">Configurar agora →</a>
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:items-start">

          {/* ════════════════ COLUNA ESQUERDA — Calculadora ════════════════ */}
          <div className="space-y-3 sm:space-y-4">

            {/* Tipo de produto */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary/10">
                  <Calculator size={16} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Tipo de produto</h2>
                  <p className="text-xs text-text-muted dark:text-stone-400">Selecione para adaptar o cálculo</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    type: 'produced' as ProductType,
                    icon: Hammer,
                    label: 'Produzido',
                    sub: 'Você fabrica',
                  },
                  {
                    type: 'resale' as ProductType,
                    icon: ShoppingBag,
                    label: 'Revenda',
                    sub: 'Compra e revende',
                  },
                  {
                    type: 'meter_product' as ProductType,
                    icon: Ruler,
                    label: 'Por metro',
                    sub: 'Banners, lonas, ACM',
                  },
                ].map(opt => {
                  const Icon = opt.icon
                  const active = productType === opt.type
                  return (
                    <button
                      key={opt.type}
                      onClick={() => setProductType(opt.type)}
                      className={clsx(
                        'flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all duration-200',
                        active
                          ? 'border-primary bg-primary-50 dark:bg-primary/10'
                          : 'border-border dark:border-border-dark hover:border-primary/40'
                      )}
                    >
                      <div className={clsx('p-2 rounded-lg', active ? 'bg-primary text-white' : 'bg-primary-50 dark:bg-primary/10 text-primary')}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className={clsx('text-xs font-semibold', active ? 'text-primary' : 'text-text-primary dark:text-stone-100')}>
                          {opt.label}
                        </p>
                        <p className="text-[10px] text-text-muted dark:text-stone-400 mt-0.5">{opt.sub}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Dados do produto */}
            <div className="card space-y-4">
              <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 flex items-center gap-2">
                <Package size={14} className="text-primary" />
                Dados do produto
              </h3>

              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                  Nome do produto *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: Copo personalizado"
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Categoria</label>
                  <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                    {['geral','caneca','copo','papelaria','quadro','vela','cosmético','roupa','acessório','embalagem','kit','outro'].map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Unidade</label>
                  <select className="input" value={unit} onChange={e => setUnit(e.target.value)}>
                    {['un','kg','g','ml','l','m','cm','par','kit','caixa'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* ── PRODUZIDO: Materiais ── */}
            {productType === 'produced' && (
              <div className="card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 flex items-center gap-2">
                      <Package size={14} className="text-primary" />
                      Materiais usados
                    </h3>
                    <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">
                      Selecione os materiais do estoque
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPicker(true)}
                    className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
                  >
                    <Plus size={13} /> Adicionar
                  </button>
                </div>

                {materials.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center border-2 border-dashed border-border dark:border-border-dark rounded-xl">
                    <Package size={24} className="text-text-muted dark:text-stone-500 mb-2" />
                    <p className="text-sm font-medium text-text-primary dark:text-stone-100">Nenhum material adicionado</p>
                    <p className="text-xs text-text-muted dark:text-stone-400 mt-1 max-w-[200px]">
                      Clique em &ldquo;Adicionar&rdquo; para selecionar materiais do estoque.
                    </p>
                    {(inventoryItems ?? []).length === 0 && (
                      <a href="/estoque" className="mt-3 text-xs text-primary hover:underline flex items-center gap-1">
                        Cadastrar material no estoque <ArrowRight size={11} />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-2 px-1">
                      <span className="col-span-5 text-[10px] font-semibold text-text-muted dark:text-stone-400 uppercase tracking-wider">Material</span>
                      <span className="col-span-3 text-[10px] font-semibold text-text-muted dark:text-stone-400 uppercase tracking-wider">Qtd</span>
                      <span className="col-span-3 text-[10px] font-semibold text-text-muted dark:text-stone-400 uppercase tracking-wider text-right">Subtotal</span>
                    </div>
                    {materials.map(m => (
                      <div key={m.tmpId} className="grid grid-cols-12 gap-2 items-center bg-primary-50/40 dark:bg-primary/5 p-2.5 rounded-xl">
                        <div className="col-span-5 min-w-0">
                          <p className="text-xs font-medium text-text-primary dark:text-stone-100 truncate">{m.name}</p>
                          <p className="text-[10px] text-text-muted dark:text-stone-500">{fmt(m.cost_per_unit)}/{m.unit}</p>
                        </div>
                        <div className="col-span-3 flex items-center gap-1">
                          <input
                            type="number"
                            min={0.01} step={0.1}
                            className="input text-xs py-1.5 px-2 w-full"
                            value={m.quantity}
                            onChange={e => updateQty(m.tmpId, parseFloat(e.target.value) || 0)}
                          />
                          <span className="text-[9px] text-text-muted flex-shrink-0">{m.unit}</span>
                        </div>
                        <div className="col-span-3 flex items-center justify-end gap-1">
                          <span className="text-xs font-bold text-primary">{fmt(m.subtotal)}</span>
                          <button
                            type="button"
                            onClick={() => removeMaterial(m.tmpId)}
                            className="p-0.5 text-text-muted hover:text-error transition-colors flex-shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t border-border dark:border-border-dark px-1">
                      <span className="text-xs font-semibold text-text-primary dark:text-stone-100">Total materiais</span>
                      <span className="text-sm font-bold text-primary">{fmt(materialCost)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PRODUZIDO: Mão de obra ── */}
            {productType === 'produced' && (
              <div className="card space-y-4">
                <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 flex items-center gap-2">
                  <Hammer size={14} className="text-primary" />
                  Mão de obra
                </h3>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Tempo de produção (horas)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      className="input w-28"
                      value={productionHours}
                      onChange={e => setProductionHours(parseFloat(e.target.value) || 0)}
                    />
                    <div className="flex-1 p-3 rounded-xl bg-primary-50 dark:bg-primary/10 border border-primary/20">
                      <p className="text-xs text-text-secondary dark:text-stone-400">
                        {productionHours}h × {fmt(hourlyRate)}/h =
                        <span className="font-bold text-primary ml-1">{fmt(laborCost)}</span>
                      </p>
                      {!fixedCosts && (
                        <p className="text-[10px] text-warning mt-0.5">
                          Configure custos fixos para cálculo preciso
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── REVENDA: Custo de compra ── */}
            {productType === 'resale' && (
              <div className="card space-y-4">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-info-light dark:bg-info/10 flex items-center justify-center flex-shrink-0">
                    <Info size={15} className="text-info" />
                  </div>
                  <p className="text-xs text-text-secondary dark:text-stone-400">
                    Produtos de revenda não precisam de cálculo de produção.
                    Informe apenas o custo de compra e a margem desejada.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Custo de compra (R$)
                  </label>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    className="input"
                    placeholder="0,00"
                    value={purchaseCost || ''}
                    onChange={e => setPurchaseCost(parseFloat(e.target.value) || 0)}
                  />
                  <p className="mt-1 text-xs text-text-muted dark:text-stone-500">
                    Quanto você paga pelo produto para revendê-lo
                  </p>
                </div>
              </div>
            )}

            {/* ── PRODUTO POR METRO: Dimensões ── */}
            {productType === 'meter_product' && (
              <div className="card space-y-4 animate-fadeIn">
                <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 flex items-center gap-2">
                  <Ruler size={14} className="text-primary" />
                  Dimensões do produto
                </h3>

                {/* Unidade de medida */}
                <div>
                  <label className="block text-xs font-semibold text-text-muted dark:text-stone-400 uppercase tracking-wider mb-2">Unidade de medida</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['cm', 'm'] as const).map(u => (
                      <button key={u} type="button" onClick={() => setMUnit(u)}
                        className={clsx('py-2.5 rounded-xl text-sm font-semibold border transition-all',
                          mUnit === u
                            ? 'border-primary bg-primary-50 dark:bg-primary/10 text-primary'
                            : 'border-border dark:border-border-dark text-text-muted hover:border-primary/50'
                        )}>
                        {u === 'cm' ? 'Centímetros (cm)' : 'Metros (m)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Largura × Altura */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                      Largura ({mUnit})
                    </label>
                    <input type="number" min={0} step={0.01} className="input"
                      placeholder={mUnit === 'cm' ? 'Ex: 100' : 'Ex: 1.00'}
                      value={mWidth || ''}
                      onChange={e => setMWidth(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                      Altura ({mUnit})
                    </label>
                    <input type="number" min={0} step={0.01} className="input"
                      placeholder={mUnit === 'cm' ? 'Ex: 80' : 'Ex: 0.80'}
                      value={mHeight || ''}
                      onChange={e => setMHeight(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>

                {/* Área calculada */}
                {mAreaM2 > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-info-light dark:bg-info/10 border border-info/20">
                    <div>
                      <p className="text-xs font-semibold text-info-dark dark:text-info uppercase tracking-wider">Área calculada</p>
                      <p className="text-xl font-bold text-info-dark dark:text-info mt-0.5">{mAreaM2.toFixed(4)} m²</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-text-muted dark:text-stone-500">= {mAreaCm2.toFixed(0)} cm²</p>
                      <p className="text-xs text-text-muted dark:text-stone-500 mt-0.5">
                        {mUnit === 'cm'
                          ? `${mWidth}cm × ${mHeight}cm`
                          : `${mWidth}m × ${mHeight}m`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Preço por m² */}
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Preço do fornecedor (R$/m²)
                  </label>
                  <input type="number" min={0} step={0.01} className="input"
                    placeholder="Ex: 50,00"
                    value={pricePerM2 || ''}
                    onChange={e => setPricePerM2(parseFloat(e.target.value) || 0)} />
                  {pricePerM2 > 0 && (
                    <p className="mt-1 text-xs text-text-muted dark:text-stone-500">
                      = {fmt(pricePerCm2)}/cm² · Custo total material: {fmt(mMaterialCost)}
                    </p>
                  )}
                </div>

                {/* Custo de acabamento */}
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Acabamento / corte / laminação (R$)
                  </label>
                  <input type="number" min={0} step={0.01} className="input"
                    placeholder="0,00"
                    value={finishingCost || ''}
                    onChange={e => setFinishingCost(parseFloat(e.target.value) || 0)} />
                  <p className="mt-1 text-xs text-text-muted dark:text-stone-500">
                    Corte, acabamento, ilhós, laminação, enrolamento, etc.
                  </p>
                </div>
              </div>
            )}

            {/* Custos extras */}
            <div className="card space-y-4">

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                    Custos extras
                  </h3>

                  <p className="text-xs text-text-muted dark:text-stone-400 mt-1">
                    Embalagem, frete, etiquetas, entrega, taxas, etc.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setExtraCosts(prev => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        name: '',
                        value: 0,
                      },
                    ])
                  }
                  className="btn-secondary text-xs py-2 px-3 flex items-center gap-2"
                >
                  <Plus size={13} />
                  Adicionar
                </button>
              </div>

              <div className="space-y-3">
                {extraCosts.map((cost, index) => (
                  <div
                    key={cost.id}
                    className="grid grid-cols-12 gap-3 items-end"
                  >
                    <div className="col-span-7">
                      <label className="block text-xs font-medium text-text-muted mb-1">
                        Nome do custo
                      </label>

                      <input
                        type="text"
                        className="input"
                        placeholder="Ex: Embalagem"
                        value={cost.name}
                        onChange={e => {
                          const updated = [...extraCosts]

                          updated[index].name = e.target.value

                          setExtraCosts(updated)
                        }}
                      />
                    </div>

                    <div className="col-span-4">
                      <label className="block text-xs font-medium text-text-muted mb-1">
                        Valor (R$)
                      </label>

                      <input
                        type="number"
                        step={0.01}
                        min={0}
                        className="input"
                        placeholder="0,00"
                        value={cost.value || ''}
                        onChange={e => {
                          const updated = [...extraCosts]

                          updated[index].value =
                            parseFloat(e.target.value) || 0

                          setExtraCosts(updated)
                        }}
                      />
                    </div>

                    <div className="col-span-1">
                      <button
                        type="button"
                        onClick={() => {
                          setExtraCosts(prev =>
                            prev.filter((_, i) => i !== index)
                          )
                        }}
                        className="w-10 h-10 rounded-xl border border-border dark:border-border-dark flex items-center justify-center hover:border-error hover:text-error transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary/10 border border-primary/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary dark:text-stone-100">
                    Total custos extras
                  </span>

                  <span className="text-lg font-bold text-primary">
                    {fmt(extraCost)}
                  </span>
                </div>
              </div>
            </div>

            {/* Slider margem */}
            <div className="card">
              <MarginSlider value={markup} onChange={setMarkup} />

              <div className="mt-4 p-3 rounded-xl bg-primary-50 dark:bg-primary/10 border border-primary/20">
                <p className="text-xs text-primary font-medium">
                  📊 Custos fixos mensais — {fmt(fixedCosts)} ÷ {workHours}h = {fmt(hourlyRate)}/hora
                </p>
              </div>
            </div>
          </div>

          {/* ════════════════ COLUNA DIREITA — Resultados ════════════════ */}
          <div className="space-y-4 lg:sticky lg:top-4 order-first lg:order-last">

            {/* Preço ideal */}
            <div className="card relative overflow-hidden" style={{
              background: 'linear-gradient(135deg, #8B6C4F 0%, #B8956A 50%, #C4A47B 100%)'
            }}>
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10 pointer-events-none"
                style={{ background: 'rgba(255,255,255,0.5)' }} />
              <p className="text-sm font-medium text-white/80 mb-1">
                {productName || 'Produto'} — Preço Ideal
              </p>
              <p className="text-5xl font-bold text-white mb-1 tracking-tight">
                {fmt(idealPrice)}
              </p>
              <p className="text-sm text-white/70">
                Margem: {margin.toFixed(1)}% · Lucro: {fmt(profit)}
              </p>
            </div>

            {/* Composição */}
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 flex items-center gap-2">
                <Calculator size={14} className="text-primary" />
                Composição do preço
              </h3>

              {productType === 'produced' ? (
                <>
                  {materialCost > 0 && (
                    <Row label="Materiais" value={materialCost} color="bg-info-light text-info-dark" />
                  )}
                  {productType === 'meter_product' && mMaterialCost > 0 && (
                    <Row label={`Material (${mAreaM2.toFixed(4)}m² × ${fmt(pricePerM2)}/m²)`} value={mMaterialCost} color="bg-info-light text-info-dark" />
                  )}
                  {productType === 'meter_product' && finishingCost > 0 && (
                    <Row label="Acabamento / corte" value={finishingCost} color="bg-warning-light text-warning-dark" />
                  )}
                  {laborCost > 0 && (
                    <Row
                      label={`Mão de obra (${productionHours}h × ${fmt(hourlyRate)})`}
                      value={laborCost}
                      color="bg-warning-light text-warning-dark"
                    />
                  )}
                </>
              ) : (
                <Row label="Custo de compra" value={purchaseCost} color="bg-info-light text-info-dark" />
              )}

              {extraCost > 0 && (
                <Row label="Extras / embalagem" value={extraCost} color="bg-primary-50 text-primary" />
              )}

              <Row label="Custo total" value={baseCost} color="bg-error-light text-error-dark" />
              <Row label={`Lucro (${markup}%)`} value={profit} color="bg-success-light text-success-dark" />

              <div className="pt-2 border-t border-border dark:border-border-dark flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary dark:text-stone-100">Preço Final</span>
                <span className="text-xl font-bold text-primary">{fmt(idealPrice)}</span>
              </div>
            </div>

            {/* Cenários */}
            <div className="card space-y-2.5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-primary" />
                <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Cenários de preço</h3>
                <p className="text-[10px] text-text-muted dark:text-stone-400 ml-auto">Clique para aplicar</p>
              </div>

              {scenarios.map(s => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setMarkup(s.markup)}
                  className={clsx(
                    'w-full flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 hover:border-primary/50 hover:shadow-card',
                    s.active
                      ? 'border-primary bg-primary-50 dark:bg-primary/10'
                      : 'border-border dark:border-border-dark'
                  )}
                >
                  <div className="text-left">
                    <p className={clsx('text-sm font-semibold', s.active ? 'text-primary' : 'text-text-primary dark:text-stone-100')}>
                      {s.label}
                    </p>
                    <p className="text-[10px] text-text-muted dark:text-stone-400">{s.sub} · {s.markup}%</p>
                  </div>
                  <div className="text-right">
                    <p className={clsx('text-base font-bold', s.active ? 'text-primary' : 'text-text-primary dark:text-stone-100')}>
                      {fmt(s.price)}
                    </p>
                    {s.active && (
                      <span className="text-[9px] bg-primary text-white px-1.5 py-0.5 rounded-full">Atual</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Salvar produto */}
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <Save size={14} className="text-primary" />
                <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                  Salvar produto
                </h3>
              </div>
              <p className="text-xs text-text-secondary dark:text-stone-400">
                O produto será salvo e aparecerá automaticamente no módulo Produtos e em Orçamentos.
              </p>


              {!productName.trim() && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-warning-light dark:bg-warning/10 border border-warning/20">
                  <AlertTriangle size={13} className="text-warning flex-shrink-0" />
                  <p className="text-xs text-warning-dark">Preencha o nome do produto para salvar.</p>
                </div>
              )}

              {savedOk && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-success-light dark:bg-success/10 border border-success/20 animate-fadeIn">
                  <CheckCircle size={14} className="text-success flex-shrink-0" />
                  <p className="text-xs text-success-dark font-medium">
                    Produto salvo com sucesso! Aparece em Produtos agora. ✅
                  </p>
                </div>
              )}

              {saveMutation.isError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-error-light dark:bg-error/10 border border-error/20">
                  <AlertTriangle size={13} className="text-error flex-shrink-0" />
                  <p className="text-xs text-error-dark">Erro ao salvar. Tente novamente.</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !productName.trim() || idealPrice <= 0}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3"
              >
                {saveMutation.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : savedOk ? (
                  <CheckCircle size={15} />
                ) : (
                  <Save size={15} />
                )}
                {saveMutation.isPending ? 'Salvando...' : savedOk ? 'Produto salvo!' : 'Salvar produto'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══ MODAL PICKER DE MATERIAIS ══ */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPicker(false)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-md animate-scaleIn max-h-[80vh] flex flex-col">
            <div className="p-5 pb-3 border-b border-border dark:border-border-dark flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Selecionar material</h3>
                <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">
                  Escolha do estoque cadastrado
                </p>
              </div>
              <button onClick={() => setShowPicker(false)} className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 border-b border-border dark:border-border-dark flex-shrink-0">
              <input
                type="text"
                autoFocus
                placeholder="Buscar material..."
                className="input"
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
              />
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-1">
              {filteredInventory.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Package size={24} className="text-text-muted dark:text-stone-500 mb-2" />
                  <p className="text-sm font-medium text-text-primary dark:text-stone-100">
                    {(inventoryItems ?? []).length === 0
                      ? 'Nenhum material no estoque'
                      : 'Nenhum resultado'
                    }
                  </p>
                  {(inventoryItems ?? []).length === 0 && (
                    <a href="/estoque" className="mt-2 text-xs text-primary hover:underline" onClick={() => setShowPicker(false)}>
                      Cadastrar material no estoque →
                    </a>
                  )}
                </div>
              ) : (
                filteredInventory.map(item => {
                  const alreadyAdded = materials.some(m => m.inventory_id === item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => addMaterial(item)}
                      className={clsx(
                        'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200',
                        alreadyAdded
                          ? 'opacity-50 cursor-not-allowed bg-success-light/30 dark:bg-success/5'
                          : 'hover:bg-primary-50 dark:hover:bg-primary/10 hover:border-primary/30 border border-transparent'
                      )}
                    >
                      <div className={clsx(
                        'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                        item.status === 'critical' ? 'bg-error-light dark:bg-error/10' :
                        item.status === 'attention' ? 'bg-warning-light dark:bg-warning/10' :
                        'bg-primary-50 dark:bg-primary/10'
                      )}>
                        <Package size={15} className={
                          item.status === 'critical' ? 'text-error' :
                          item.status === 'attention' ? 'text-warning' : 'text-primary'
                        } />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">{item.name}</p>
                        <p className="text-xs text-text-muted dark:text-stone-400">
                          Estoque: {item.quantity} {item.unit} · {fmt(Number(item.cost_per_unit))}/{item.unit}
                        </p>
                      </div>
                      {alreadyAdded ? (
                        <span className="text-[10px] text-success font-medium flex-shrink-0">✓ Adicionado</span>
                      ) : (
                        <ChevronRight size={14} className="text-text-muted flex-shrink-0" />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Row helper ─── */
function Row({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-secondary dark:text-stone-400 truncate pr-2">{label}</span>
      <span className={clsx('badge font-bold flex-shrink-0', color)}>{
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
      }</span>
    </div>
  )
}
