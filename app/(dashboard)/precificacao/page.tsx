'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import {
  Calculator, TrendingUp, Plus, X, Package, Ruler,
  Save, CheckCircle, Loader2, AlertTriangle,
  ShoppingBag, Hammer, ChevronRight,
  ArrowRight, Info, Tag, Layers, FileText,
  Scissors, Trash2, Edit2, BookOpen,
  Scale, Droplets, Settings2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { CategorySelect } from '@/components/ui/CategorySelect'
import { formatCurrency as fmt } from '@/lib/utils/format'
import { formatDimDisplay, formatAreaM2, getDimBlock } from '@/lib/utils/dimensions'
import { useSubscription } from '@/hooks/useSubscription'

/* ─────────────────────────── Types ─── */
type ProductType = 'produced' | 'resale' | 'meter_product'
type PricingType = 'per_unit' | 'per_m2' | 'per_linear_meter' | 'per_kg' | 'per_liter' | 'custom'
type FinishingCalcType = 'fixed' | 'percent' | 'per_m2' | 'per_unit' | 'per_meter'

interface FinishingItem {
  id:           string
  name:         string
  calc_type:    FinishingCalcType
  value:        number
  quantity?:    number
  from_catalog?: string
}

const CALC_TYPES: { value: FinishingCalcType; label: string; hint: string }[] = [
  { value: 'fixed',     label: 'Valor fixo',      hint: 'R$ único' },
  { value: 'percent',   label: 'Percentual',       hint: '% do material' },
  { value: 'per_m2',    label: 'Por m²',           hint: 'R$/m²' },
  { value: 'per_meter', label: 'Por metro linear', hint: 'R$/m' },
  { value: 'per_unit',  label: 'Por unidade',      hint: 'R$/un' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PRICING_TYPES: { value: PricingType; label: string; sub: string; icon: any }[] = [
  { value: 'per_unit',        label: 'Por unidade',     sub: 'Canecas, camisetas…',       icon: Package   },
  { value: 'per_m2',          label: 'Por m²',          sub: 'Banners, lonas, ACM',       icon: Ruler     },
  { value: 'per_linear_meter', label: 'Metro linear',   sub: 'Cortinas, fitas, perfis',   icon: Ruler     },
  { value: 'per_kg',          label: 'Por kg',          sub: 'Alimentos, matéria-prima',  icon: Scale     },
  { value: 'per_liter',       label: 'Por litro',       sub: 'Tintas, produtos líquidos', icon: Droplets  },
  { value: 'custom',          label: 'Personalizado',   sub: 'Mostrar todos os campos',   icon: Settings2 },
]

type FinishingModal =
  | null
  | { mode: 'picker' }
  | { mode: 'edit'; item: FinishingItem; isNew: boolean }
  | { mode: 'new_catalog'; draft: { name: string; calc_type: FinishingCalcType; default_value: number; category: string } }

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
/* fmt importado de @/lib/utils/format (função global de moeda) */

function computeFinishingSubtotal(item: FinishingItem, area: number, materialCost: number): number {
  switch (item.calc_type) {
    case 'fixed':     return item.value
    case 'percent':   return materialCost * item.value / 100
    case 'per_m2':    return area * item.value
    case 'per_unit':
    case 'per_meter': return (item.quantity ?? 1) * item.value
    default:          return item.value
  }
}

function finishingLabel(item: FinishingItem, area: number, materialCost: number): string {
  switch (item.calc_type) {
    case 'fixed':     return 'R$ fixo'
    case 'percent':   return `${item.value}% do material`
    case 'per_m2':    return `${area.toFixed(4).replace('.', ',')} m² × R$${item.value}`
    case 'per_unit':  return `${item.quantity ?? 1} un × R$${item.value}`
    case 'per_meter': return `${item.quantity ?? 1} m × R$${item.value}`
    default:          return ''
  }
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

/* ─────────────────────────── SectionSlide ─── */
function SectionSlide({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="slide"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ═══════════════════════════════════════ PAGE ═══ */
function PrecificacaoPage() {
  const supabase    = createClient()
  const queryClient = useQueryClient()

  const [companyId, setCompanyId] = useState<string | null>(null)
  const { data: sub } = useSubscription()
  const searchParams = useSearchParams()
  const editingProductId = searchParams.get('productId') ?? null

  /* ── form state ── */
  const [productType,      setProductType]      = useState<ProductType>('produced')
  const [pricingType,      setPricingType]      = useState<PricingType>('per_unit')
  const [productName,      setProductName]      = useState('')
  const [category,         setCategory]         = useState('geral')
  const [unit,             setUnit]             = useState('un')
  const [markup,           setMarkup]           = useState(100)
  const [productionHours,  setProductionHours]  = useState(1)
  const [purchaseCost,     setPurchaseCost]     = useState(0)
  // ── Produto por metro ──
  const [mWidth,           setMWidth]           = useState<number>(0)
  const [mHeight,          setMHeight]          = useState<number>(0)
  const [mUnit,            setMUnit]            = useState<'cm'|'m'>('cm')
  const [pricePerM2,       setPricePerM2]       = useState<number>(0)
  const [finishingItems,   setFinishingItems]   = useState<FinishingItem[]>([])
  const [finishingModal,   setFinishingModal]   = useState<FinishingModal>(null)
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

  // ── Specs técnicas ──
  const [finishings,      setFinishings]      = useState<string[]>([])
  const [finishingType,   setFinishingType]   = useState<string>('')
  const [technicalNotes,  setTechnicalNotes]  = useState<string>('')
  const [customFinishing,   setCustomFinishing]   = useState('')

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
        .select('work_hours_per_month, fixed_costs, prolabore').eq('id', companyId!).single()
      return res?.data
    },
  })

  /* ── Carregar produto existente para edição ── */
  const { data: existingProduct } = useQuery({
    queryKey: ['product-for-edit', editingProductId],
    enabled:  !!editingProductId,
    queryFn:  async () => {
      const { data: prod } = await (supabase.from('products') as any)
        .select('*').eq('id', editingProductId!).maybeSingle()
      const { data: mats } = await (supabase.from('product_materials') as any)
        .select('*').eq('product_id', editingProductId!).order('created_at')
      return { product: prod, materials: mats ?? [] }
    },
  })

  /* ── Quando abre em modo edição: preencher estados com dados do banco ── */
  const [loadedProductId, setLoadedProductId] = useState<string | null>(null)
  useEffect(() => {
    if (!existingProduct?.product || loadedProductId === editingProductId) return
    const p = existingProduct.product as any
    setLoadedProductId(editingProductId)
    setProductName(p.name ?? '')
    setCategory(p.category ?? 'geral')
    setUnit(p.unit ?? 'un')
    setMarkup(Number(p.markup_percentage) || 100)
    setProductionHours(Number(p.production_time_hours) || 1)
    setPurchaseCost(Number(p.purchase_cost) || 0)
    if (p.product_type) setProductType(p.product_type as ProductType)
    if (p.pricing_type) {
      setPricingType(p.pricing_type as PricingType)
    } else if (p.product_type === 'meter_product') {
      setPricingType('per_m2')
    } else {
      setPricingType('per_unit')
    }
    // Custos extras: salvo em extra_costs JSONB ou reconstituído de extra_cost
    if (p.extra_costs && Array.isArray(p.extra_costs)) {
      setExtraCosts(p.extra_costs)
    } else if (Number(p.extra_cost) > 0) {
      setExtraCosts([{ id: crypto.randomUUID(), name: 'Custo extra', value: Number(p.extra_cost) }])
    }
    // Materiais: reconstituir MaterialLine dos product_materials salvos
    // Buscar custo atualizado do estoque (inventory) para cada material
    const mats = existingProduct.materials as any[]
    if (mats.length > 0) {
      setMaterials(mats.map(m => ({
        tmpId:        crypto.randomUUID(),
        inventory_id: m.inventory_id ?? '',
        name:         m.material_name,
        unit:         m.unit,
        stock:        0,
        cost_per_unit: Number(m.unit_cost),
        quantity:      Number(m.quantity),
        subtotal:      Number(m.quantity) * Number(m.unit_cost),
      })))
    }
    // Campos de produto por metro
    if (p.product_type === 'meter_product') {
      if (p.width)           setMWidth(Number(p.width))
      if (p.height)          setMHeight(Number(p.height))
      if (p.measurement_unit) setMUnit(p.measurement_unit as 'cm' | 'm')
      if (p.price_per_m2)    setPricePerM2(Number(p.price_per_m2))
      if (Array.isArray(p.finishing_items) && p.finishing_items.length > 0) {
        setFinishingItems(p.finishing_items as FinishingItem[])
      }
    }
    // Specs técnicas
    if (Array.isArray(p.finishings))  setFinishings(p.finishings)
    if (p.finishing_type)  setFinishingType(p.finishing_type)
    if (p.technical_notes) setTechnicalNotes(p.technical_notes)
  }, [existingProduct, editingProductId, loadedProductId])

  // Buscar tabela fixed_costs (mesma fonte que Configurações)
  const { data: fixedCostsData } = useQuery({
    queryKey: ['fixed_costs-pricing', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data } = await (supabase.from('fixed_costs') as any)
        .select('amount').eq('company_id', companyId!).eq('is_active', true)
      return (data ?? []) as { amount: number }[]
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

  const { data: finishingCatalog } = useQuery<{ id: string; name: string; category: string | null; calc_type: string; default_value: number }[]>({
    queryKey: ['finishing-catalog', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data } = await (supabase.from('finishing_catalog') as any)
        .select('id, name, category, calc_type, default_value')
        .eq('company_id', companyId!).eq('is_active', true).order('name')
      return data ?? []
    },
  })

  const addCatalogItemMutation = useMutation({
    mutationFn: async (draft: { name: string; calc_type: string; default_value: number; category: string }) => {
      await (supabase.from('finishing_catalog') as any).insert([{ company_id: companyId, ...draft }])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finishing-catalog', companyId] })
      setFinishingModal(null)
    },
  })

  /* ── Quando inventoryItems carrega em modo edição, atualizar custo atual dos materiais ── */
  useEffect(() => {
    if (!inventoryItems || !editingProductId || materials.length === 0) return
    setMaterials(prev => prev.map(m => {
      if (!m.inventory_id) return m
      const inv = inventoryItems.find(i => i.id === m.inventory_id)
      if (!inv) return m
      return { ...m, cost_per_unit: inv.cost_per_unit, subtotal: m.quantity * inv.cost_per_unit }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryItems])

  /* ── Calculated values ── */
  const workHours    = Number((company as any)?.work_hours_per_month ?? 160)

  // Somar tabela fixed_costs — fallback para companies.fixed_costs se tabela vazia
  const fixedCostsFromTable = (fixedCostsData ?? []).reduce((s, c) => s + Number(c.amount), 0)
  const fixedCostsLegacy    = Number((company as any)?.fixed_costs ?? 0)
  const fixedCostsTotal     = fixedCostsFromTable > 0 ? fixedCostsFromTable : fixedCostsLegacy

  // Pró-labore: lê do Supabase (companies.prolabore) — funciona em TODOS os dispositivos
  // Fallback para localStorage se a coluna ainda não existir
  const [prolabore, setProlabore] = useState(0)
  useEffect(() => {
    if (!companyId) return
    // 1. Tentar ler do Supabase (fonte primária — multi-device)
    const dbProlabore = Number((company as any)?.prolabore)
    if (dbProlabore > 0) {
      setProlabore(dbProlabore)
      return
    }
    // 2. Fallback: localStorage (dispositivo local)
    try {
      const raw = localStorage.getItem(`precy_routine_${companyId}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.prolabore !== undefined) setProlabore(Number(parsed.prolabore) || 0)
      }
    } catch { /* localStorage indisponível em SSR/mobile */ }
  }, [companyId, company])

  // custo/hora = (custos_fixos + pro_labore) ÷ horas_mes  (MESMA fórmula das Configurações)
  const hourlyRate   = workHours > 0 ? (fixedCostsTotal + prolabore) / workHours : 0
  const laborCost    = (productType === 'produced' || productType === 'meter_product') ? hourlyRate * productionHours : 0
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
      ? mMaterialCost + finishingItems.reduce((s, i) => s + computeFinishingSubtotal(i, mAreaM2, mMaterialCost), 0) + laborCost + extraCost
      : purchaseCost + extraCost

  const idealPrice   = baseCost > 0 ? baseCost * (1 + markup / 100) : 0
  const profit       = idealPrice - baseCost
  const margin       = idealPrice > 0 ? (profit / idealPrice) * 100 : 0

  const showPrintSections = pricingType === 'per_m2' || pricingType === 'per_linear_meter' || pricingType === 'custom'

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

      /* Limite do plano Basic — só verifica em CRIAÇÃO, não em edição
         (editar um produto existente não aumenta a contagem) */
      if (!editingProductId && sub && !sub.isPro) {
        const limit = sub.limits.products
        if (Number.isFinite(limit)) {
          const { count } = await supabase
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', companyId)
          if ((count ?? 0) >= limit) {
            throw new Error(`Limite de ${limit} produtos do plano Basic atingido. Faça upgrade para o PRO e cadastre produtos ilimitados.`)
          }
        }
      }

      const productPayload = {
        name: productName.trim(),
        category,
        unit,
        production_time_hours: productType === 'produced' ? productionHours : 0,
        material_cost:         productType === 'produced' ? materialCost : purchaseCost,
        extra_cost:            extraCost,
        extra_costs:           extraCosts,
        markup_percentage:     markup,
        final_price:           idealPrice,
        product_type:          productType,
        labor_cost:            laborCost,
        total_cost:            baseCost,
        purchase_cost:         productType === 'resale' ? purchaseCost : 0,
        ...(productType === 'meter_product' ? {
          width: mWidth, height: mHeight, measurement_unit: mUnit,
          area: mAreaM2,
          price_per_m2: pricePerM2,
          finishing_items: finishingItems.map(i => ({ ...i, subtotal: computeFinishingSubtotal(i, mAreaM2, mMaterialCost) })),
        } : {}),
        finishings:      finishings,
        finishing_type:  finishingType || null,
        technical_notes: technicalNotes || null,
        pricing_type:    pricingType,
        updated_at: new Date().toISOString(),
      }

      /* ── MODO EDIÇÃO: UPDATE do produto existente ── */
      if (editingProductId) {
        const { error: updateError } = await (supabase.from('products') as any)
          .update(productPayload)
          .eq('id', editingProductId)
        if (updateError) throw updateError

        // Remover materiais antigos e reinserir com valores atualizados
        await (supabase.from('product_materials') as any)
          .delete().eq('product_id', editingProductId)

        if (productType === 'produced' && materials.length > 0) {
          const rows = materials.map(m => ({
            company_id:    companyId,
            product_id:    editingProductId,
            inventory_id:  m.inventory_id,
            material_name: m.name,
            quantity:      m.quantity,
            unit:          m.unit,
            unit_cost:     m.cost_per_unit,
            subtotal:      m.subtotal,
          }))
          const { error: mErr } = await (supabase.from('product_materials') as any).insert(rows)
          if (mErr) throw mErr
        }
        return { id: editingProductId }
      }

      /* ── MODO CRIAÇÃO: INSERT novo produto ── */
      const { data: product, error: productError } = await (supabase
        .from('products') as any)
        .insert({ company_id: companyId, is_active: true, ...productPayload })
        .select()
        .single()

      if (productError) {
        console.error(productError)
        throw productError
      }

      /* ─── Salvar materiais utilizados ─── */
      if (productType === 'produced' && materials.length > 0) {
        const materialRows = materials.map(m => ({
          company_id:    companyId,
          product_id:    product.id,
          inventory_id:  m.inventory_id,
          material_name: m.name,
          quantity:      m.quantity,
          unit:          m.unit,
          unit_cost:     m.cost_per_unit,
          subtotal:      m.subtotal,
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
      queryClient.invalidateQueries({ queryKey: ['products', companyId] })
      queryClient.invalidateQueries({ queryKey: ['inventory-picker', companyId] })
      queryClient.invalidateQueries({ queryKey: ['product-for-edit', editingProductId] })
      queryClient.invalidateQueries({ queryKey: ['product-materials', editingProductId] })

      setSavedOk(true)
      setTimeout(() => { setSavedOk(false) }, 3000)

      // Em modo edição, NÃO limpar os campos — usuário pode continuar editando
      if (!editingProductId) {
        setProductName('')
        setCategory('geral')
        setUnit('un')
        setMarkup(100)
        setProductionHours(1)
        setPurchaseCost(0)
        setExtraCosts([{ id: crypto.randomUUID(), name: '', value: 0 }])
        setMaterials([])
        setFinishings([])
        setFinishingType('')
        setTechnicalNotes('')
        setFinishingItems([])
        setPricingType('per_unit')
      }
    },

    onError: error => {
      console.error(error)
    },
  })

/* ═══════════════════════════════ RENDER ═══ */
  return (
    <div className="page-enter">
      <Header
        title={editingProductId ? 'Editar Precificação' : 'Precificação'}
        subtitle={editingProductId
          ? 'Edite os dados, materiais e margem do produto existente'
          : 'Calcule o preço ideal e cadastre seu produto'
        }
      />

      {/* Banner modo edição */}
      {editingProductId && (
        <div className="mx-3 sm:mx-5 lg:mx-6 mb-2 flex items-center justify-between gap-3 p-3 rounded-xl border border-primary/25 bg-primary/5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm">✏️</span>
            <p className="text-xs font-medium text-primary truncate">
              Modo edição — alterações serão salvas no produto existente
            </p>
          </div>
          <a href="/produtos" className="text-xs font-medium text-text-muted hover:text-primary transition-colors flex-shrink-0">
            ← Voltar
          </a>
        </div>
      )}

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── Info banner quando não tem custos fixos ── */}
        {fixedCostsTotal === 0 && prolabore === 0 && (
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

            {/* Tipo de precificação */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary/10">
                  <Tag size={16} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Tipo de precificação</h2>
                  <p className="text-xs text-text-muted dark:text-stone-400">Define os campos exibidos na calculadora</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRICING_TYPES.map(opt => {
                  const Icon = opt.icon
                  const active = pricingType === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setPricingType(opt.value)
                        if (opt.value === 'per_m2' || opt.value === 'per_linear_meter') {
                          setProductType('meter_product')
                        } else if (opt.value !== 'custom' && productType === 'meter_product') {
                          setProductType('produced')
                        }
                      }}
                      className={clsx(
                        'flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 text-left transition-all duration-200',
                        active
                          ? 'border-primary bg-primary-50 dark:bg-primary/10'
                          : 'border-border dark:border-border-dark hover:border-primary/40'
                      )}
                    >
                      <div className={clsx('p-1.5 rounded-lg', active ? 'bg-primary text-white' : 'bg-primary-50 dark:bg-primary/10 text-primary')}>
                        <Icon size={14} />
                      </div>
                      <div>
                        <p className={clsx('text-xs font-semibold leading-snug', active ? 'text-primary' : 'text-text-primary dark:text-stone-100')}>
                          {opt.label}
                        </p>
                        <p className="text-[10px] text-text-muted dark:text-stone-400 mt-0.5 leading-tight">{opt.sub}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

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
                  <CategorySelect
                    value={category}
                    onChange={setCategory}
                    placeholder="Selecione ou crie..."
                  />
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
                          <p className="text-xs font-medium text-text-primary dark:text-stone-100 leading-snug break-words">{m.name}</p>
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

            {/* ── PRODUZIDO + POR METRO: Mão de obra ── */}
            {(productType === 'produced' || productType === 'meter_product') && (
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
                      {fixedCostsTotal === 0 && prolabore === 0 && (
                        <p className="text-[10px] text-warning mt-0.5">
                          Configure custos fixos em Configurações para cálculo preciso
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
                {mAreaM2 > 0 && (()=>{
                  const block = getDimBlock(mWidth, mHeight, mUnit)
                  const wFmt = block.wM.toFixed(4).replace('.', ',')
                  const hFmt = block.hM.toFixed(4).replace('.', ',')
                  return (
                    <div className="rounded-xl bg-info-light dark:bg-info/10 border border-info/20 overflow-hidden">
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-semibold text-info/50 uppercase tracking-wider mb-0.5">Dimensões informadas</p>
                          <p className="text-sm font-medium text-info-dark dark:text-info">{block.original}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-semibold text-info/50 uppercase tracking-wider mb-0.5">Área</p>
                          <p className="text-xl font-bold text-info-dark dark:text-info">{block.area} m²</p>
                        </div>
                      </div>
                      {block.meters && (
                        <details className="border-t border-info/15">
                          <summary className="px-4 py-1.5 text-[11px] text-info/60 cursor-pointer select-none hover:text-info transition-colors list-none flex items-center gap-1">
                            <span className="text-[9px]">▶</span> Ver detalhes do cálculo
                          </summary>
                          <div className="px-4 pb-3 space-y-1.5 bg-info/5">
                            <div>
                              <p className="text-[10px] font-semibold text-info/50 uppercase tracking-wider">Conversão para metros</p>
                              <p className="text-xs text-info-dark/70 dark:text-info/70">{block.meters}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-info/50 uppercase tracking-wider">Fórmula</p>
                              <p className="text-xs text-info-dark/60 dark:text-info/60">{wFmt} × {hFmt} = <span className="font-semibold text-info-dark dark:text-info">{block.area} m²</span></p>
                            </div>
                          </div>
                        </details>
                      )}
                    </div>
                  )
                })()}

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

                {/* Acabamentos e Processos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-text-primary dark:text-stone-200 flex items-center gap-1.5">
                      <Scissors size={14} className="text-warning"/> Acabamentos e Processos
                    </label>
                    <div className="flex gap-1.5">
                      <button type="button"
                        onClick={() => setFinishingModal({ mode: 'new_catalog', draft: { name: '', calc_type: 'fixed', default_value: 0, category: '' } })}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border dark:border-stone-700 text-[11px] text-text-muted hover:border-primary/50 hover:text-primary transition-colors">
                        <BookOpen size={11}/> Novo no catálogo
                      </button>
                      <button type="button"
                        onClick={() => setFinishingModal({ mode: 'picker' })}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-warning/10 border border-warning/30 text-[11px] font-medium text-warning-dark dark:text-warning hover:bg-warning/20 transition-colors">
                        <Plus size={11}/> Adicionar
                      </button>
                    </div>
                  </div>

                  {finishingItems.length > 0 ? (
                    <div className="space-y-1.5">
                      {finishingItems.map(item => {
                        const sub = computeFinishingSubtotal(item, mAreaM2, mMaterialCost)
                        const lbl = finishingLabel(item, mAreaM2, mMaterialCost)
                        return (
                          <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-warning/5 border border-warning/20">
                            <Scissors size={12} className="text-warning flex-shrink-0"/>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-text-primary dark:text-stone-200 leading-snug">{item.name}</p>
                              <p className="text-[10px] text-text-muted dark:text-stone-500">{lbl}</p>
                            </div>
                            <span className="text-xs font-bold text-warning-dark dark:text-warning">{fmt(sub)}</span>
                            <button type="button" onClick={() => setFinishingModal({ mode: 'edit', item, isNew: false })}
                              className="p-1 rounded-lg hover:bg-warning/20 text-text-muted hover:text-warning transition-colors">
                              <Edit2 size={11}/>
                            </button>
                            <button type="button" onClick={() => setFinishingItems(prev => prev.filter(i => i.id !== item.id))}
                              className="p-1 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors">
                              <Trash2 size={11}/>
                            </button>
                          </div>
                        )
                      })}
                      <div className="flex justify-between items-center pt-1.5 px-1">
                        <span className="text-[11px] text-text-muted">Total acabamentos</span>
                        <span className="text-sm font-bold text-warning-dark dark:text-warning">
                          {fmt(finishingItems.reduce((s, i) => s + computeFinishingSubtotal(i, mAreaM2, mMaterialCost), 0))}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setFinishingModal({ mode: 'picker' })}
                      className="w-full py-3 border-2 border-dashed border-warning/30 rounded-xl text-[11px] text-text-muted hover:border-warning/60 hover:text-warning transition-colors flex items-center justify-center gap-1.5">
                      <Plus size={12}/> Laminação, corte, ilhós, dobra…
                    </button>
                  )}
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

            <SectionSlide show={showPrintSections}>
              <div className="space-y-3 sm:space-y-4">

                {/* ── Acabamentos (multi-select chips) ── */}
                <div className="card space-y-3">
                  <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 flex items-center gap-2">
                    <Layers size={14} className="text-primary" />
                    Acabamentos
                  </h3>
                  <p className="text-xs text-text-muted dark:text-stone-400 -mt-1">
                    Selecione um ou mais acabamentos aplicados neste produto
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['Laminação Fosca','Laminação Brilho','Laminação Holográfica','Recorte eletrônico','Corte reto','Meio corte','Vinco','Dobra','Cantos arredondados','Ilhós','Bastão','Bainha','Verniz Localizado','Hot Stamping','Refile','Furação','Corte Especial'].map(opt => {
                      const active = finishings.includes(opt)
                      return (
                        <button key={opt} type="button"
                          onClick={() => setFinishings(prev => active ? prev.filter(f => f !== opt) : [...prev, opt])}
                          className={clsx(
                            'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                            active
                              ? 'border-primary bg-primary text-white'
                              : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400 hover:border-primary/50'
                          )}>
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input flex-1 text-sm"
                      placeholder="Outro acabamento..."
                      value={customFinishing}
                      onChange={e => setCustomFinishing(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && customFinishing.trim()) {
                          const v = customFinishing.trim()
                          if (!finishings.includes(v)) setFinishings(prev => [...prev, v])
                          setCustomFinishing('')
                        }
                      }}
                    />
                    <button type="button"
                      disabled={!customFinishing.trim()}
                      onClick={() => {
                        const v = customFinishing.trim()
                        if (v && !finishings.includes(v)) setFinishings(prev => [...prev, v])
                        setCustomFinishing('')
                      }}
                      className="btn-secondary px-3 py-2 text-xs">
                      <Plus size={13} />
                    </button>
                  </div>
                  {finishings.filter(f => !['Laminação Fosca','Laminação Brilho','Laminação Holográfica','Recorte eletrônico','Corte reto','Meio corte','Vinco','Dobra','Cantos arredondados','Ilhós','Bastão','Bainha','Verniz Localizado','Hot Stamping','Refile','Furação','Corte Especial'].includes(f)).map(f => (
                    <div key={f} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-primary bg-primary text-white w-fit">
                      {f}
                      <button type="button" onClick={() => setFinishings(prev => prev.filter(x => x !== f))} className="ml-1 opacity-75 hover:opacity-100"><X size={11} /></button>
                    </div>
                  ))}
                </div>

                {/* ── Finalização / Entrega (single-select chips) ── */}
                <div className="card space-y-3">
                  <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 flex items-center gap-2">
                    <Tag size={14} className="text-primary" />
                    Finalização / Entrega
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Em cartela','Em folhas','Em bobina','Dobrado','Enrolado','Recortado',
                      'Separado por kits','Embalado individualmente','Embalado em pacote',
                      'Instalado','Aplicado','Com ilhós','Com bastão','Com bainha',
                      'Sem finalização','Outros',
                    ].map(opt => {
                      const isOthersSelected = finishingType.startsWith('Outros')
                      const active = opt === 'Outros' ? isOthersSelected : finishingType === opt
                      return (
                        <button key={opt} type="button"
                          onClick={() => {
                            if (opt === 'Outros') {
                              setFinishingType(isOthersSelected ? '' : 'Outros: ')
                            } else {
                              setFinishingType(active ? '' : opt)
                            }
                          }}
                          className={clsx(
                            'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                            active
                              ? 'border-primary bg-primary text-white'
                              : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400 hover:border-primary/50'
                          )}>
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                  {finishingType.startsWith('Outros') && (
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="Descreva a finalização... ex: Enrolado em tubo de papelão"
                      value={finishingType.replace(/^Outros:\s*/, '')}
                      onChange={e => setFinishingType('Outros: ' + e.target.value)}
                    />
                  )}
                </div>

                {/* ── Observações Técnicas ── */}
                <div className="card space-y-3">
                  <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 flex items-center gap-2">
                    <FileText size={14} className="text-primary" />
                    Observações Técnicas
                  </h3>
                  <textarea
                    className="input min-h-[80px] resize-y text-sm"
                    placeholder="Ex: Impressão em alta resolução, sangria de 3mm, arquivo em CMYK..."
                    value={technicalNotes}
                    onChange={e => setTechnicalNotes(e.target.value)}
                  />
                </div>

              </div>
            </SectionSlide>

            {/* Slider margem */}
            <div className="card">
              <MarginSlider value={markup} onChange={setMarkup} />

              <div className="mt-4 p-3 rounded-xl bg-primary-50 dark:bg-primary/10 border border-primary/20">
                <p className="text-xs text-primary font-medium">
                  📊 Custo/hora = ({fmt(fixedCostsTotal)} custos fixos + {fmt(prolabore)} pró-labore) ÷ {workHours}h/mês = {fmt(hourlyRate)}/h
                </p>
              </div>
            </div>

            {/* ── MOBILE ONLY: banner resultado calculado ── */}
            {idealPrice > 0 && (
              <div
                className="lg:hidden rounded-2xl p-4 text-center cursor-pointer active:scale-[0.98] transition-transform"
                style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)' }}
                onClick={() => {
                  // Scroll suave para o resultado
                  document.getElementById('resultado-precificacao')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                <p className="text-white/80 text-xs mb-1">✅ Cálculo pronto! Preço ideal:</p>
                <p className="text-white text-2xl font-bold">{fmt(idealPrice)}</p>
                <p className="text-white/70 text-xs mt-1">Toque para ver resultado completo ↓</p>
              </div>
            )}
          </div>

          {/* ════════════════ COLUNA DIREITA — Resultados ════════════════ */}
          {/* Mobile: só aparece após cálculo (idealPrice > 0). Desktop: sempre visível à direita. */}
          <div
            id="resultado-precificacao"
            className={clsx(
              'space-y-4 lg:sticky lg:top-4 order-last lg:order-last',
              // No mobile: oculta enquanto não houver resultado calculado
              idealPrice <= 0 && 'hidden lg:block'
            )}>

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
                  {laborCost > 0 && (
                    <Row
                      label={`Mão de obra (${productionHours}h × ${fmt(hourlyRate)})`}
                      value={laborCost}
                      color="bg-warning-light text-warning-dark"
                    />
                  )}
                </>
              ) : productType === 'meter_product' ? (
                <>
                  {mMaterialCost > 0 && (
                    <Row label={`Material (${mAreaM2.toFixed(4)}m² × ${fmt(pricePerM2)}/m²)`} value={mMaterialCost} color="bg-info-light text-info-dark" />
                  )}
                  {finishingItems.map(item => {
                    const sub = computeFinishingSubtotal(item, mAreaM2, mMaterialCost)
                    return sub > 0 ? (
                      <Row key={item.id} label={item.name} value={sub} color="bg-warning-light text-warning-dark" />
                    ) : null
                  })}
                  {laborCost > 0 && (
                    <Row label={`Mão de obra (${productionHours}h × ${fmt(hourlyRate)})`} value={laborCost} color="bg-warning-light text-warning-dark" />
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
                  <p className="text-xs text-error-dark">
                    {(saveMutation.error as Error)?.message || 'Erro ao salvar. Tente novamente.'}
                  </p>
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
                {saveMutation.isPending
                  ? 'Salvando...'
                  : savedOk
                    ? (editingProductId ? 'Produto atualizado! ✅' : 'Produto salvo!')
                    : (editingProductId ? 'Atualizar produto' : 'Salvar produto')
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══ MODAL PICKER DE MATERIAIS ══ */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPicker(false)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-lg animate-scaleIn max-h-[85vh] flex flex-col">
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
                        'w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all duration-200',
                        alreadyAdded
                          ? 'opacity-50 cursor-not-allowed bg-success-light/30 dark:bg-success/5'
                          : 'hover:bg-primary-50 dark:hover:bg-primary/10 hover:border-primary/30 border border-transparent'
                      )}
                    >
                      <div className={clsx(
                        'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
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
                        {/* Nome completo — sem truncate, quebra linha se necessário */}
                        <p className="text-sm font-medium text-text-primary dark:text-stone-100 leading-snug break-words">
                          {item.name}
                        </p>
                        {/* Linha de detalhes */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {item.category && item.category !== 'geral' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-primary-50 dark:bg-primary/10 text-primary">
                              {item.category}
                            </span>
                          )}
                          <span className="text-xs text-text-muted dark:text-stone-400">
                            Estoque: {item.quantity} {item.unit}
                          </span>
                          <span className="text-[10px] text-text-muted dark:text-stone-500">·</span>
                          <span className="text-xs font-medium text-primary">
                            {fmt(Number(item.cost_per_unit))}/{item.unit}
                          </span>
                          {item.status === 'critical' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-error-light dark:bg-error/10 text-error">
                              Crítico
                            </span>
                          )}
                          {item.status === 'attention' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-warning-light dark:bg-warning/10 text-warning-dark dark:text-warning">
                              Atenção
                            </span>
                          )}
                        </div>
                      </div>
                      {alreadyAdded ? (
                        <span className="text-[10px] text-success font-medium flex-shrink-0 mt-1">✓ Adicionado</span>
                      ) : (
                        <ChevronRight size={14} className="text-text-muted flex-shrink-0 mt-1" />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAIS DE ACABAMENTOS ══════════════════════════════════════════ */}

      {/* Picker: lista do catálogo */}
      {finishingModal?.mode === 'picker' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setFinishingModal(null)}/>
          <div className="relative bg-white dark:bg-surface-dark w-full sm:max-w-sm rounded-2xl shadow-modal animate-scaleIn overflow-hidden">
            <div className="p-4 border-b border-border dark:border-border-dark flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-primary dark:text-stone-100 flex items-center gap-2"><Scissors size={14} className="text-warning"/> Adicionar acabamento</h3>
              <button onClick={() => setFinishingModal(null)} className="p-1.5 rounded-xl hover:bg-primary-50 text-text-muted"><X size={15}/></button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-border dark:divide-stone-800">
              {(finishingCatalog ?? []).length === 0 && (
                <p className="text-xs text-text-muted text-center py-6">Nenhum acabamento no catálogo.<br/>Crie um abaixo.</p>
              )}
              {(finishingCatalog ?? []).map(cat => (
                <button key={cat.id} type="button"
                  onClick={() => setFinishingModal({ mode: 'edit', isNew: true, item: {
                    id: crypto.randomUUID(), name: cat.name,
                    calc_type: cat.calc_type as FinishingCalcType,
                    value: cat.default_value, from_catalog: cat.id
                  }})}
                  className="w-full text-left px-4 py-3 hover:bg-primary-50/50 dark:hover:bg-primary/10 transition-colors flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary dark:text-stone-100">{cat.name}</p>
                    {cat.category && <p className="text-[10px] text-text-muted">{cat.category}</p>}
                  </div>
                  <span className="text-[11px] text-text-muted">{CALC_TYPES.find(t => t.value === cat.calc_type)?.hint}</span>
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-border dark:border-border-dark space-y-2">
              <button type="button"
                onClick={() => setFinishingModal({ mode: 'edit', isNew: true, item: { id: crypto.randomUUID(), name: '', calc_type: 'fixed', value: 0 } })}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-border dark:border-stone-700 text-[12px] text-text-muted hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center gap-1.5">
                <Plus size={12}/> Outro acabamento (uso único)
              </button>
              <button type="button"
                onClick={() => setFinishingModal({ mode: 'new_catalog', draft: { name: '', calc_type: 'fixed', default_value: 0, category: '' } })}
                className="w-full py-2.5 rounded-xl bg-primary/5 border border-primary/20 text-[12px] font-medium text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1.5">
                <BookOpen size={12}/> Criar no catálogo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor: ajustar item antes de adicionar / editar existente */}
      {finishingModal?.mode === 'edit' && (()=>{
        const { item, isNew } = finishingModal
        const sub = computeFinishingSubtotal(item, mAreaM2, mMaterialCost)
        const needsQty = item.calc_type === 'per_unit' || item.calc_type === 'per_meter'
        function save(){
          if(!item.name.trim()) return
          if(isNew){
            setFinishingItems(prev => [...prev, item])
          } else {
            setFinishingItems(prev => prev.map(i => i.id === item.id ? item : i))
          }
          setFinishingModal(null)
        }
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setFinishingModal(null)}/>
            <div className="relative bg-white dark:bg-surface-dark w-full sm:max-w-sm rounded-2xl shadow-modal animate-scaleIn overflow-hidden">
              <div className="p-4 border-b border-border dark:border-border-dark flex items-center justify-between">
                <h3 className="text-sm font-bold text-text-primary dark:text-stone-100">{isNew ? 'Novo acabamento' : 'Editar acabamento'}</h3>
                <button onClick={() => setFinishingModal(null)} className="p-1.5 rounded-xl hover:bg-primary-50 text-text-muted"><X size={15}/></button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Nome</label>
                  <input className="input text-sm" placeholder="Ex: Laminação Brilho"
                    value={item.name}
                    onChange={e => setFinishingModal({ mode: 'edit', isNew, item: { ...item, name: e.target.value } })}/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Tipo de cálculo</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CALC_TYPES.map(t => (
                      <button key={t.value} type="button"
                        onClick={() => setFinishingModal({ mode: 'edit', isNew, item: { ...item, calc_type: t.value } })}
                        className={clsx('py-2 px-2 rounded-xl text-[11px] font-medium border transition-all text-left',
                          item.calc_type === t.value
                            ? 'border-primary bg-primary text-white'
                            : 'border-border dark:border-stone-700 text-text-secondary dark:text-stone-400 hover:border-primary/50')}>
                        <span className="block font-semibold">{t.label}</span>
                        <span className="block text-[10px] opacity-70">{t.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className={clsx('grid gap-2', needsQty ? 'grid-cols-2' : 'grid-cols-1')}>
                  <div>
                    <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">
                      {item.calc_type === 'percent' ? 'Percentual (%)' : 'Valor (R$)'}
                    </label>
                    <input type="number" min={0} step={0.01} className="input text-sm"
                      placeholder={item.calc_type === 'percent' ? 'Ex: 15' : 'Ex: 5,20'}
                      value={item.value || ''}
                      onChange={e => setFinishingModal({ mode: 'edit', isNew, item: { ...item, value: parseFloat(e.target.value) || 0 } })}/>
                  </div>
                  {needsQty && (
                    <div>
                      <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">
                        {item.calc_type === 'per_meter' ? 'Metros' : 'Quantidade'}
                      </label>
                      <input type="number" min={1} step={1} className="input text-sm"
                        placeholder="Ex: 10"
                        value={item.quantity ?? ''}
                        onChange={e => setFinishingModal({ mode: 'edit', isNew, item: { ...item, quantity: parseInt(e.target.value) || 1 } })}/>
                    </div>
                  )}
                </div>
                {item.value > 0 && mAreaM2 > 0 && (
                  <div className="px-3 py-2 rounded-xl bg-warning/10 border border-warning/20 flex justify-between items-center">
                    <span className="text-[11px] text-text-muted">{finishingLabel(item, mAreaM2, mMaterialCost)}</span>
                    <span className="text-sm font-bold text-warning-dark dark:text-warning">{fmt(sub)}</span>
                  </div>
                )}
              </div>
              <div className="p-4 flex gap-3 border-t border-border dark:border-border-dark">
                <button onClick={() => setFinishingModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={save} disabled={!item.name.trim()} className="btn-primary flex-1 disabled:opacity-50">Salvar</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Novo item no catálogo permanente */}
      {finishingModal?.mode === 'new_catalog' && (()=>{
        const { draft } = finishingModal
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setFinishingModal(null)}/>
            <div className="relative bg-white dark:bg-surface-dark w-full sm:max-w-sm rounded-2xl shadow-modal animate-scaleIn overflow-hidden">
              <div className="p-4 border-b border-border dark:border-border-dark flex items-center justify-between">
                <h3 className="text-sm font-bold text-text-primary dark:text-stone-100 flex items-center gap-2"><BookOpen size={14} className="text-primary"/> Novo acabamento no catálogo</h3>
                <button onClick={() => setFinishingModal(null)} className="p-1.5 rounded-xl hover:bg-primary-50 text-text-muted"><X size={15}/></button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Nome *</label>
                  <input className="input text-sm" placeholder="Ex: Laminação Soft Touch"
                    value={draft.name}
                    onChange={e => setFinishingModal({ mode: 'new_catalog', draft: { ...draft, name: e.target.value } })}/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Categoria</label>
                  <input className="input text-sm" placeholder="Ex: Laminação, Corte, Montagem…"
                    value={draft.category}
                    onChange={e => setFinishingModal({ mode: 'new_catalog', draft: { ...draft, category: e.target.value } })}/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Tipo de cálculo</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CALC_TYPES.map(t => (
                      <button key={t.value} type="button"
                        onClick={() => setFinishingModal({ mode: 'new_catalog', draft: { ...draft, calc_type: t.value } })}
                        className={clsx('py-2 px-2 rounded-xl text-[11px] font-medium border transition-all text-left',
                          draft.calc_type === t.value
                            ? 'border-primary bg-primary text-white'
                            : 'border-border dark:border-stone-700 text-text-secondary dark:text-stone-400 hover:border-primary/50')}>
                        <span className="block font-semibold">{t.label}</span>
                        <span className="block text-[10px] opacity-70">{t.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Valor padrão</label>
                  <input type="number" min={0} step={0.01} className="input text-sm" placeholder="0,00"
                    value={draft.default_value || ''}
                    onChange={e => setFinishingModal({ mode: 'new_catalog', draft: { ...draft, default_value: parseFloat(e.target.value) || 0 } })}/>
                </div>
              </div>
              <div className="p-4 flex gap-3 border-t border-border dark:border-border-dark">
                <button onClick={() => setFinishingModal({ mode: 'picker' })} className="btn-secondary flex-1">Voltar</button>
                <button
                  disabled={!draft.name.trim() || addCatalogItemMutation.isPending}
                  onClick={() => addCatalogItemMutation.mutate({ name: draft.name, calc_type: draft.calc_type, default_value: draft.default_value, category: draft.category })}
                  className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2">
                  {addCatalogItemMutation.isPending && <Loader2 size={13} className="animate-spin"/>}
                  Salvar no catálogo
                </button>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}

/* ─── Row helper ─── */
function Row({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-secondary dark:text-stone-400 truncate pr-2">{label}</span>
      <span className={clsx('badge font-bold flex-shrink-0', color)}>{fmt(value)}</span>
    </div>
  )
}

/* Suspense wrapper necessário para useSearchParams no Next.js App Router */
export default function PrecificacaoPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PrecificacaoPage />
    </Suspense>
  )
}
