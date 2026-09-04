'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { useCompanyId } from '@/hooks/useCompanyId'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { clsx } from 'clsx'
import { format, addDays, differenceInCalendarDays, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatCurrency } from '@/lib/utils/format'
import {
  FileText, Plus, X, Loader2, Trash2, Download,
  CheckCircle, XCircle, Clock, Send, ChevronRight,
  ChevronLeft, User, Package, CreditCard, Truck,
  Eye, Search, Edit3, Edit2, Minus, Info, ShoppingBag, ExternalLink, Copy,
} from 'lucide-react'
import { calculateAreaM2, formatAreaM2, formatDimDisplay, getDimBlock } from '@/lib/utils/dimensions'
import { companyPickupAddressLines, companyPickupAddressText } from '@/lib/company/pickupAddress'
import { BudgetItemArtwork } from '@/components/orcamentos/BudgetItemArtwork'
import { Paperclip } from 'lucide-react'

interface BudgetItem {
  id: string; type: 'product'|'service'|'manual'; name: string
  description: string; quantity: number; unit_price: number
  discount: number; subtotal: number; product_id?: string
  // Especificações técnicas
  width?: number; height?: number; area?: number; measurement_unit?: string
  finishings?: string[]; finishing_type?: string; technical_notes?: string
  // Modo de precificação
  pricing_mode?: 'fixed'|'square_meter'
  price_per_m2?: number
}
interface NewClientData { name: string; phone: string; email: string }
type Step = 1|2|3|4|5

const STATUS_CONFIG: Record<string,{label:string;badge:string;icon:React.ElementType}> = {
  draft:     { label:'Rascunho',   badge:'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',    icon:Clock       },
  sent:      { label:'Enviado',    badge:'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',     icon:Send        },
  approved:  { label:'Aprovado',   badge:'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', icon:CheckCircle },
  rejected:  { label:'Recusado',  badge:'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',          icon:XCircle     },
  converted: { label:'Convertido', badge:'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon:CheckCircle },
}
function fmt(v:number){ return formatCurrency(v) }
// UUID de verdade (não só uma string aleatória) — precisa ser um UUID válido
// porque agora é usado como id definitivo de budget_items (ver saveMutation),
// e arquivos de arte (budget_item_files) referenciam esse id via FK.
function uid(){
  return typeof crypto!=='undefined'&&crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
        const r=Math.random()*16|0, v=c==='x'?r:(r&0x3|0x8)
        return v.toString(16)
      })
}
// Contagem de prazo sempre começa no dia seguinte à emissão
function prazoVencimento(issueDate:Date, days:number){ return addDays(startOfDay(issueDate), Math.max(1,days)) }
function prazoEquivDays(issueDate:Date, dateStr:string){
  if(!dateStr) return 0
  return Math.max(0, differenceInCalendarDays(startOfDay(new Date(dateStr+'T00:00:00')), startOfDay(issueDate)))
}

const STEP_META=[
  {step:1,label:'Cliente',  icon:User      },
  {step:2,label:'Itens',    icon:Package   },
  {step:3,label:'Pagamento',icon:CreditCard},
  {step:4,label:'Entrega',  icon:Truck     },
  {step:5,label:'Revisão',  icon:Eye       },
] as const

const PAYMENT_OPTIONS=['PIX','Dinheiro','Cartão crédito','Cartão débito','Boleto','Transferência','Parcelado']
const FINISHING_TYPE_OPTIONS=[
  'Em cartela','Em folhas','Em bobina','Dobrado','Enrolado','Recortado',
  'Separado por kits','Embalado individualmente','Embalado em pacote',
  'Instalado','Aplicado','Com ilhós','Com bastão','Com bainha',
  'Sem finalização','Outros',
]
const DELIVERY_OPTIONS=[
  {value:'pickup',   label:'Retirada',      emoji:'🏪'},
  {value:'delivery', label:'Entrega',        emoji:'🚗'},
  {value:'motoboy',  label:'Motoboy',        emoji:'🏍️'},
  {value:'correios', label:'Correios',       emoji:'📦'},
  {value:'carrier',  label:'Transportadora', emoji:'🚚'},
]

/* Prazo de produção sugerido para orçamentos novos (ou como fallback quando
   um orçamento antigo não tem nada gravado em budgets.production_days).
   Nunca sobrescreve um valor já salvo. */
const DEFAULT_PRODUCTION_DAYS='2 a 3 dias úteis'

export default function OrcamentosPage() {
  const supabase=createClient(), qc=useQueryClient(), {toast}=useToast(), {companyId}=useCompanyId()
  const [showWizard,setShowWizard]=useState(false)
  const [editingBudgetId,setEditingBudgetId]=useState<string|null>(null)
  const [deleteId,setDeleteId]=useState<string|null>(null)
  const [generating,setGenerating]=useState(false)
  const [step,setStep]=useState<Step>(1)
  const [saving,setSaving]=useState(false)
  const [clientMode,setClientMode]=useState<'existing'|'new'>('existing')
  const [clientId,setClientId]=useState('')
  const [clientSearch,setClientSearch]=useState('')
  const [newClient,setNewClient]=useState<NewClientData>({name:'',phone:'',email:''})
  const [items,setItems]=useState<BudgetItem[]>([])
  const [globalDisc,setGlobalDisc]=useState(0)
  const [editItem,setEditItem]=useState<BudgetItem|null>(null)
  const [addMode,setAddMode]=useState<'product'|null>(null)
  const [prodSearch,setProdSearch]=useState('')
  const [payMethod,setPayMethod]=useState('')
  const [payCondition,setPayCond]=useState<'avista'|'parcelado'|'entrada'|'prazo'>('avista')
  const [installments,setInstall]=useState(2)
  const [signalAmt,setSignalAmt]=useState(0)
  const [signalMode,setSignalMode]=useState<'value'|'percent'>('value')
  const [signalPct,setSignalPct]=useState(50)
  const [prazoType,setPrazoType]=useState<'dias'|'data'>('dias')
  const [prazoDays,setPrazoDays]=useState(30)
  const [prazoDate,setPrazoDate]=useState('')
  const [issueDate,setIssueDate]=useState<Date>(new Date())
  const [deliveryType,setDelivType]=useState('pickup')
  const [deliveryFee,setDelivFee]=useState(0)
  const [deliveryAddr,setDelivAddr]=useState('')
  const [validUntil,setValidUntil]=useState('')
  const [prodDays,setProdDays]=useState('')
  const [delivDays,setDelivDays]=useState('')
  const [notes,setNotes]=useState('')
  const [status,setStatus]=useState('draft')
  const [companyData,setCompanyData]=useState<Record<string,unknown>|null>(null)
  const [converting,setConverting]=useState<string|null>(null) // budget id sendo convertido
  const [duplicatingBudget,setDuplicatingBudget]=useState<string|null>(null)

  useEffect(()=>{
    async function load(){
      const {data:{user}}=await supabase.auth.getUser()
      if(!user)return
      const r:any=await supabase.from('companies').select('*').eq('user_id',user.id).single()
      if(r?.data?.id)setCompanyData(r.data)
    }
    load()
  },[])

  const {data:budgets,isLoading}=useQuery<any[]>({
    queryKey:['budgets',companyId],enabled:!!companyId,
    queryFn:async()=>{
      const r:any=await supabase.from('budgets').select('*,customers(name,email,phone,city,state,cpf_cnpj)').eq('company_id',companyId!).order('created_at',{ascending:false})
      return r?.data??[]
    },
  })
  const {data:customers}=useQuery<any[]>({
    queryKey:['customers-select',companyId],enabled:!!companyId,
    queryFn:async()=>{
      const r:any=await supabase.from('customers').select('id,name,phone,email').eq('company_id',companyId!).order('name')
      return r?.data??[]
    },
  })
  const {data:products}=useQuery<any[]>({
    queryKey:['products-select',companyId],enabled:!!companyId,
    queryFn:async()=>{
      const r:any=await supabase.from('products').select('id,name,final_price,category,width,height,area,measurement_unit,finishings,finishing_type,technical_notes').eq('company_id',companyId!).eq('is_active',true).order('name')
      return r?.data??[]
    },
  })

  // Arte anexada por item (só existe depois que o orçamento foi salvo pelo
  // menos uma vez — mesma limitação de Pedidos, que também exige o pedido já
  // salvo para anexar arquivos). Uma query só por orçamento, agrupada por item.
  const {data:itemFiles,refetch:refetchItemFiles}=useQuery<import('@/components/orcamentos/types').BudgetItemFile[]>({
    queryKey:['budget-item-files',editingBudgetId],
    enabled:!!editingBudgetId,
    queryFn:async()=>{
      const r:any=await supabase.from('budget_item_files').select('*').eq('budget_id',editingBudgetId!).order('created_at',{ascending:false})
      if(r.error)throw r.error
      return r.data??[]
    },
  })
  const filesByItem=(itemFiles??[]).reduce((acc:Record<string,import('@/components/orcamentos/types').BudgetItemFile>,f)=>{
    if(!acc[f.budget_item_id])acc[f.budget_item_id]=f // mais recente primeiro (order by created_at desc)
    return acc
  },{})

  const subtotal=items.reduce((s,i)=>s+i.subtotal,0)
  const totalDisc=items.reduce((s,i)=>s+(i.unit_price*i.quantity*(i.discount/100)),0)+Number(globalDisc)
  const total=Math.max(0,subtotal+Number(deliveryFee)-totalDisc)
  const filteredCustomers=(customers??[]).filter(c=>clientSearch===''||c.name.toLowerCase().includes(clientSearch.toLowerCase()))
  const filteredProducts=(products??[]).filter(p=>prodSearch===''||p.name.toLowerCase().includes(prodSearch.toLowerCase()))

  function goNext(){setStep(s=>Math.min(5,s+1)as Step)}
  function goPrev(){setStep(s=>Math.max(1,s-1)as Step)}
  function canProceed(){
    if(step===1)return clientMode==='existing'?!!clientId:newClient.name.trim().length>0
    if(step===2)return items.length>0
    if(step===3&&payCondition==='prazo'){
      if(prazoType==='dias')return prazoDays>=1
      return !!prazoDate&&prazoDate>=format(new Date(),'yyyy-MM-dd')
    }
    return true
  }
  function openWizard(){
    setEditingBudgetId(null)
    setStep(1);setItems([]);setClientId('');setClientSearch('');setNewClient({name:'',phone:'',email:''})
    setClientMode('existing');setGlobalDisc(0);setPayMethod('');setPayCond('avista')
    setInstall(2);setSignalAmt(0);setSignalMode('value');setSignalPct(50)
    setPrazoType('dias');setPrazoDays(30);setPrazoDate('');setIssueDate(new Date())
    setDelivType('pickup');setDelivFee(0);setDelivAddr('');setValidUntil(format(addDays(new Date(),20),'yyyy-MM-dd'))
    setProdDays(DEFAULT_PRODUCTION_DAYS);setDelivDays('');setNotes('');setStatus('draft');setShowWizard(true)
  }

  async function openEdit(b:any){
    setEditingBudgetId(b.id)
    // Carregar itens do orçamento
    const {data:bi}=await(supabase.from('budget_items')as any).select('*').eq('budget_id',b.id)
    const loadedItems=(bi??[]).map((i:any)=>({
      id:              i.id||uid(),
      type:            (i.product_id ? 'product' : 'manual') as 'product'|'manual',
      name:            i.name||'Item',
      description:     i.description||'',
      quantity:        Number(i.quantity)||1,
      unit_price:      Number(i.unit_price)||0,
      discount:        0,
      subtotal:        Number(i.subtotal)||0,
      product_id:      i.product_id||undefined,
      width:           i.width           ?? undefined,
      height:          i.height          ?? undefined,
      area:            i.area            ?? undefined,
      measurement_unit:i.measurement_unit?? 'm',
      finishings:      Array.isArray(i.finishings) ? i.finishings : [],
      finishing_type:  i.finishing_type  ?? undefined,
      technical_notes: i.technical_notes ?? undefined,
      pricing_mode:    (i.pricing_mode as 'fixed'|'square_meter') ?? 'fixed',
      price_per_m2:    i.price_per_m2    ?? undefined,
    }))
    setItems(loadedItems)
    // Cliente
    if(b.customer_id){setClientId(b.customer_id);setClientMode('existing')}
    else{setClientMode('existing');setClientId('')}
    setClientSearch('')
    setNewClient({name:'',phone:'',email:''})
    // Valores
    setGlobalDisc(Number(b.discount)||0)
    // Pagamento
    setPayMethod((b as any).payment_method||'')
    setPayCond(((b as any).pay_condition as typeof payCondition)||'avista')
    setInstall(Number((b as any).installments)||2)
    setSignalAmt(Number((b as any).signal_amount)||0)
    setSignalMode('value');setSignalPct(50)
    setPrazoType(((b as any).prazo_type as 'dias'|'data')||'dias')
    setPrazoDays(Number((b as any).prazo_dias)||30)
    setPrazoDate((b as any).prazo_due_date?String((b as any).prazo_due_date).split('T')[0]:'')
    setIssueDate(b.created_at?new Date(b.created_at):new Date())
    // Entrega — restaura o que foi salvo (colunas budgets.delivery_*)
    setDelivType((b as any).delivery_type||'pickup')
    setDelivFee(Number((b as any).delivery_fee)||0)
    setDelivAddr((b as any).delivery_addr||'')
    // Prazos
    setValidUntil(b.valid_until?b.valid_until.split('T')[0]:'')
    // production_days salvo tem prioridade; só usa o padrão se estiver vazio
    setProdDays((b as any).production_days||DEFAULT_PRODUCTION_DAYS)
    setDelivDays((b as any).delivery_days||'')
    // Notas + status
    setNotes(b.notes||'');setStatus(b.status||'draft')
    setStep(1);setShowWizard(true)
  }
  function addItemFromProduct(p:any){
    setItems(prev=>[...prev,{
      id:uid(),type:'product',name:p.name,description:'',
      quantity:1,unit_price:Number(p.final_price),discount:0,subtotal:Number(p.final_price),
      product_id:p.id,
      width:           p.width          ?? undefined,
      height:          p.height         ?? undefined,
      area:            p.area           ?? undefined,
      measurement_unit:p.measurement_unit?? undefined,
      finishings:      Array.isArray(p.finishings) ? p.finishings : [],
      finishing_type:  p.finishing_type ?? undefined,
      technical_notes: p.technical_notes?? undefined,
    }])
    setAddMode(null);setProdSearch('')
  }
  function openNewItem(type:'service'|'manual'){
    setEditItem({id:uid(),type,name:'',description:'',quantity:1,unit_price:0,discount:0,subtotal:0,finishings:[],pricing_mode:'fixed',measurement_unit:'m'})
    setAddMode(null)
  }

  function applySquareMeterCalc(base: BudgetItem, overrides: Partial<BudgetItem>): BudgetItem {
    const merged = {...base, ...overrides}
    const w = merged.width, h = merged.height
    const u = merged.measurement_unit ?? 'm'
    const ppm2 = merged.price_per_m2 ?? 0
    const area = w && h && w > 0 && h > 0 ? calculateAreaM2(w, h, u) : 0
    const unit_price = area * ppm2
    return {...merged, area: area || undefined, unit_price}
  }
  function saveEditItem(item:BudgetItem){
    const sub=item.unit_price*item.quantity*(1-item.discount/100)
    const updated={...item,subtotal:sub}
    setItems(prev=>{
      const idx=prev.findIndex(i=>i.id===item.id)
      if(idx>=0){const n=[...prev];n[idx]=updated;return n}
      return [...prev,updated]
    })
    setEditItem(null)
  }
  function removeItem(id:string){setItems(prev=>prev.filter(i=>i.id!==id))}

  const saveMutation=useMutation({
    mutationFn:async()=>{
      setSaving(true)
      let finalCustomerId=clientId
      if(clientMode==='new'&&newClient.name.trim()){
        const {data:nc,error}=await(supabase.from('customers')as any).insert([{company_id:companyId!,name:newClient.name.trim(),phone:newClient.phone||null,email:newClient.email||null}]).select('id').single()
        if(error)throw error
        finalCustomerId=nc.id
        qc.invalidateQueries({queryKey:['customers-select',companyId]})
      }

      // Payload base (colunas que sempre existem)
      const basePayload={
        customer_id: finalCustomerId||null,
        notes:       notes||null,
        valid_until: validUntil?new Date(validUntil).toISOString():null,
        subtotal, discount:totalDisc, total, status,
      }
      // Payload extra (colunas adicionadas pelas migrations)
      const extraPayload={
        updated_at:      new Date().toISOString(),
        payment_method:  payMethod||null,
        pay_condition:   payCondition||null,
        installments:    installments>1?installments:null,
        signal_amount:   (()=>{
          if(payCondition!=='entrada') return null
          const v = signalMode==='percent'
            ? Math.round(total*(signalPct/100)*100)/100
            : signalAmt
          return v>0 ? v : null
        })(),
        prazo_type:      payCondition==='prazo' ? prazoType : null,
        prazo_dias:      payCondition!=='prazo' ? null : (
          prazoType==='dias' ? Math.max(1,prazoDays) : prazoEquivDays(issueDate,prazoDate)
        ),
        prazo_due_date:  payCondition!=='prazo' ? null : (
          prazoType==='data' ? (prazoDate||null) : format(prazoVencimento(issueDate,prazoDays),'yyyy-MM-dd')
        ),
        delivery_type:   deliveryType||null,
        delivery_fee:    deliveryType==='pickup' ? 0 : (deliveryFee||0),
        delivery_addr:   deliveryType==='pickup'
          ? (companyPickupAddressText(companyData as any) || null)
          : (deliveryAddr||null),
        delivery_days:   delivDays||null,
        production_days: prodDays||null,
      }
      // Tenta salvar com todos os campos; se falhar por coluna inexistente, salva só o base
      const budgetPayload = { ...basePayload, ...extraPayload }

      let budgetId:string

      if(editingBudgetId){
        // UPDATE orçamento existente
        let updateRes:any=await(supabase.from('budgets')as any).update(budgetPayload).eq('id',editingBudgetId)
        if(updateRes?.error?.code==='42703'){
          updateRes=await(supabase.from('budgets')as any).update(basePayload).eq('id',editingBudgetId)
        }
        if(updateRes?.error)throw updateRes.error
        budgetId=editingBudgetId
        // Remove só os itens que o usuário de fato excluiu nesta edição —
        // itens mantidos preservam seu id (upsert abaixo), o que é essencial
        // para não perder a arte anexada (budget_item_files referencia
        // budget_items.id via FK). Antes disso o código apagava e recriava
        // TODOS os itens a cada save, gerando ids novos sempre.
        const {data:existingItems}=await(supabase.from('budget_items')as any).select('id').eq('budget_id',budgetId)
        const currentIds=new Set(items.map(i=>i.id))
        const idsToDelete=(existingItems??[]).map((r:any)=>r.id).filter((id:string)=>!currentIds.has(id))
        if(idsToDelete.length>0){
          await(supabase.from('budget_items')as any).delete().in('id',idsToDelete)
        }
      }else{
        // INSERT novo orçamento
        let budgetRes:any = await(supabase.from('budgets')as any)
          .insert([{company_id:companyId!,...budgetPayload,budget_number:''}]).select('id').single()
        // Se falhou por coluna inexistente, tentar com payload base
        if(budgetRes?.error?.code==='42703'){
          budgetRes=await(supabase.from('budgets')as any)
            .insert([{company_id:companyId!,...basePayload,budget_number:''}]).select('id').single()
        }
        const {data:budget,error:bErr}=budgetRes
        if(bErr)throw bErr
        budgetId=budget.id
      }

      if(budgetId&&items.length>0){
        // upsert (não insert puro): preserva o id de cada item entre saves,
        // para que a arte anexada (budget_item_files) não perca o vínculo.
        await(supabase.from('budget_items')as any).upsert(items.map(i=>({
          id:              i.id,
          budget_id:       budgetId,
          product_id:      i.product_id     || null,
          name:            i.name           || null,
          description:     i.description    || null,
          quantity:        i.quantity,
          unit_price:      i.unit_price,
          subtotal:        i.subtotal,
          width:           i.width          ?? null,
          height:          i.height         ?? null,
          area:            i.area           ?? null,
          measurement_unit:i.measurement_unit?? null,
          finishings:      i.finishings?.length ? i.finishings : null,
          finishing_type:  i.finishing_type ?? null,
          technical_notes: i.technical_notes?? null,
          pricing_mode:    i.pricing_mode   ?? 'fixed',
          price_per_m2:    i.price_per_m2   ?? null,
        })))
      }
    },
    onSuccess:()=>{
      qc.invalidateQueries({queryKey:['budgets',companyId]})
      toast('success',editingBudgetId?'Orçamento atualizado!':'Orçamento salvo!')
      setShowWizard(false);setSaving(false);setEditingBudgetId(null)
    },
    onError:(err:Error)=>{console.error('[orcamentos]',err);toast('error',`Erro: ${err.message}`);setSaving(false)},
  })

  const deleteMutation=useMutation({
    mutationFn:async(id:string)=>{await(supabase.from('budgets')as any).delete().eq('id',id)},
    onSuccess:()=>{qc.invalidateQueries({queryKey:['budgets',companyId]});toast('success','Removido.');setDeleteId(null)},
    onError:(err:Error)=>toast('error',`Erro: ${err.message}`),
  })

  async function handleGeneratePDF(b:any){
    setGenerating(true)
    try{
      const[{generateBudgetPDF},{getBudgetItems},{getOrderArtFiles}]=await Promise.all([
        import('@/lib/pdf/generateBudgetPDF'),
        import('@/lib/pdf/getBudgetItems'),
        import('@/lib/pdf/getOrderArtFiles'),
      ])

      // Orçamento completo com cliente expandido
      const {data:fullBudget}=await(supabase.from('budgets')as any)
        .select('*,customers(id,name,email,phone,city,state,cpf_cnpj,address)')
        .eq('id',b.id).single()

      // Arte: o orçamento não tem arquivos próprios — se já virou pedido,
      // busca a arte anexada a esse pedido (order_files via converted_to_order_id).
      const convertedOrderId = (fullBudget ?? b)?.converted_to_order_id as string | undefined
      const artFiles = convertedOrderId ? await getOrderArtFiles(convertedOrderId) : []

      // Itens com produto vinculado (para resolver nome e specs via JOIN)
      const {data:bi}=await(supabase.from('budget_items')as any)
        .select('*,products(name,description,category,width,height,area,measurement_unit,finishings,finishing_type,technical_notes)')
        .eq('budget_id',b.id)

      // Fonte única de verdade — getBudgetItems lida com itens reais e fallback legado
      const effectiveItems = getBudgetItems(fullBudget??b, bi??[])

      await generateBudgetPDF({
        budget: fullBudget??b,
        items:  effectiveItems as any,
        company:companyData,
        artFiles,
      })
    }catch(err){
      console.error('[pdf]',err)
      toast('error','Erro ao gerar PDF.')
    }
    finally{setGenerating(false)}
  }

  /* ─── Converter Orçamento → Pedido ─── */
  async function handleConvertToOrder(b: any) {
    if (!companyId) return
    if (converting) return // já há uma conversão em andamento (anti duplo-clique)

    // Anti-duplicação: se já tem pedido vinculado, não cria outro — leva para o pedido
    if (b.converted_to_order_id) {
      toast('info', 'Este orçamento já foi convertido. Abrindo o pedido vinculado…')
      window.location.href = '/pedidos'
      return
    }

    // Revalida no banco antes de criar (evita corrida se a lista estiver desatualizada)
    const { data: fresh } = await (supabase.from('budgets') as any)
      .select('converted_to_order_id')
      .eq('id', b.id)
      .maybeSingle()
    if (fresh?.converted_to_order_id) {
      toast('info', 'Este orçamento já foi convertido. Abrindo o pedido vinculado…')
      qc.invalidateQueries({ queryKey: ['budgets', companyId] })
      window.location.href = '/pedidos'
      return
    }

    setConverting(b.id)
    try {
      // 1. Buscar itens do orçamento (com fallback de dados do produto)
      const { data: bi } = await (supabase.from('budget_items') as any)
        .select('*, products(name, description, width, height, area, measurement_unit, finishings, finishing_type, technical_notes)')
        .eq('budget_id', b.id)

      const customer = b.customers as any
      const customerId = b.customer_id

      // 2. Entrada acordada no orçamento — apenas informativa. NÃO é recebimento:
      //    aprovar orçamento não registra pagamento. O dinheiro só entra quando
      //    o usuário clicar em "Registrar Recebimento" no pedido.
      const sigAmt = Number(b.signal_amount) || 0
      const orderTotal = Number(b.total) || 0

      // 3. Criar pedido na tabela orders
      const orderPayload: Record<string, unknown> = {
        company_id:     companyId,
        customer_id:    customerId,
        order_number:   '',            // trigger gera PED-XXXX automaticamente
        service_name:   (bi ?? []).length > 0
          ? (bi![0].name || 'Pedido')
          : (customer?.name ? `Pedido — ${customer.name}` : 'Pedido'),
        description:    b.notes || null,
        status:         'pending',
        payment_status: 'pending',           // nada recebido até registro manual
        payment_method: b.payment_method  || null,
        subtotal:       Number(b.subtotal) || 0,
        discount:       Number(b.discount) || 0,
        total:          orderTotal,
        signal_amount:  sigAmt,               // entrada acordada (informativo)
        remaining_amount: orderTotal,         // saldo devedor = total (nada recebido)
        notes:          b.notes || null,
        // delivery_days é texto livre ("até 5 dias", "3"...) — só vira data se for numérico puro
        due_date:       (() => {
          const n = Number(b.delivery_days)
          return Number.isFinite(n) && n > 0
            ? new Date(Date.now() + n * 86400000).toISOString()
            : null
        })(),
        priority:       'normal',
        quote_id:       b.id,          // vínculo com orçamento original
      }

      // A tabela `orders` NÃO possui colunas de entrega (delivery_type/delivery_addr).
      // Esses dados permanecem no orçamento e são acessados pelo pedido via `quote_id`
      // (ver lib/pdf/orderQuoteData + handleGeneratePDF em Pedidos). Retirada = endereço
      // fixo da LumiLife, resolvido a partir do orçamento vinculado.
      const { data: order, error: orderErr } = await (supabase.from('orders') as any)
        .insert([orderPayload])
        .select('id, order_number')
        .single()

      if (orderErr) throw new Error(orderErr.message)

      // 3b. Copiar todos os itens do orçamento para order_items (carrinho completo, não só o primeiro)
      const itemRows = (bi ?? []).map((i: any) => ({
        order_id:         order.id,
        product_id:       i.product_id || null,
        name:             i.name             || i.products?.name        || 'Item',
        description:      i.description      || i.products?.description || null,
        quantity:         Number(i.quantity)   || 1,
        unit_price:       Number(i.unit_price) || 0,
        discount:         0,
        discount_type:    'amount',
        subtotal:         Number(i.subtotal)   || 0,
        width:            i.width             ?? i.products?.width             ?? null,
        height:           i.height            ?? i.products?.height            ?? null,
        area:             i.area              ?? i.products?.area              ?? null,
        measurement_unit: i.measurement_unit  ?? i.products?.measurement_unit  ?? null,
        finishings:       Array.isArray(i.finishings)          ? i.finishings
                        : Array.isArray(i.products?.finishings) ? i.products.finishings
                        : [],
        finishing_type:   i.finishing_type   ?? i.products?.finishing_type   ?? null,
        technical_notes:  i.technical_notes  ?? i.products?.technical_notes  ?? null,
      }))

      if (itemRows.length === 0 && Number(b.total) > 0) {
        // Orçamento legado sem itens salvos — sintetiza 1 item a partir do total
        itemRows.push({
          order_id: order.id, product_id: null,
          name: (orderPayload.service_name as string) || 'Item', description: null,
          quantity: 1, unit_price: Number(b.total), discount: 0, discount_type: 'amount',
          subtotal: Number(b.total), width: null, height: null, area: null,
          measurement_unit: null, finishings: [], finishing_type: null, technical_notes: null,
        })
      }

      if (itemRows.length > 0) {
        const { error: itemsErr } = await (supabase.from('order_items') as any).insert(itemRows)
        if (itemsErr) throw new Error(itemsErr.message)
      }

      // 4. Marcar orçamento como convertido + salvar referência do pedido
      await (supabase.from('budgets') as any).update({
        status:               'converted',
        converted_to_order_id: order.id,
        updated_at:           new Date().toISOString(),
      }).eq('id', b.id)

      // 5. (sem lançamento financeiro automático) — a entrada/sinal do orçamento
      //    é só uma condição acordada; o recebimento é registrado manualmente
      //    pelo usuário em "Registrar Recebimento" no pedido.

      // 6. Agenda: se o prazo de entrega for numérico (dias), criar tarefa
      const delivDaysNum = Number(b.delivery_days)
      if (Number.isFinite(delivDaysNum) && delivDaysNum > 0 && order?.id) {
        const dueDate = new Date(Date.now() + delivDaysNum * 86400000)
        await (supabase.from('calendar_tasks') as any).insert([{
          company_id:  companyId,
          title:       `Entrega — ${order.order_number}`,
          description: `Pedido originado do orçamento ${b.budget_number || ''}`,
          due_date:    dueDate.toISOString().split('T')[0],
          status:      'pending',
          priority:    'normal',
          order_id:    order.id,
        }]).select()
      }

      // 7. Invalidar caches
      qc.invalidateQueries({ queryKey: ['budgets', companyId] })
      qc.invalidateQueries({ queryKey: ['orders', companyId] })
      qc.invalidateQueries({ queryKey: ['dashboard', companyId] })
      qc.invalidateQueries({ queryKey: ['transactions', companyId] })

      toast('success', `✔ Pedido ${order.order_number} criado com sucesso!`)
    } catch (err: unknown) {
      console.error('[convert]', err)
      toast('error', `Erro ao criar pedido: ${(err as Error).message}`)
    } finally {
      setConverting(null)
    }
  }

  /* ─── Duplicar Orçamento ─── */
  async function handleDuplicateBudget(b: any) {
    if (!companyId) return
    setDuplicatingBudget(b.id)
    let createdBudgetId: string | null = null
    try {
      // 1. Buscar itens do orçamento original
      const { data: bi, error: biErr } = await (supabase.from('budget_items') as any)
        .select('*').eq('budget_id', b.id)
      if (biErr) throw biErr

      // 2. Montar payload APENAS com colunas reais de `budgets`.
      //    `b` vem da query da lista com `.select('*,customers(...)')`, portanto
      //    contém a relação aninhada `customers` — que NÃO é uma coluna e faria
      //    o insert falhar ("Could not find the 'customers' column of 'budgets'").
      //    O cliente é referenciado pela coluna `customer_id`.
      const basePayload = {
        company_id:  companyId,
        customer_id: b.customer_id ?? null,
        budget_number: '',            // trigger set_budget_number gera ORC-XXXX
        status:      'draft',         // status inicial padrão (default da coluna)
        subtotal:    b.subtotal ?? 0,
        discount:    b.discount ?? 0,
        total:       b.total ?? 0,
        notes:       b.notes ? `Cópia de ${b.budget_number || 'ORC'} — ${b.notes}` : null,
        valid_until: b.valid_until ?? null,
        // converted_to_order_id é intencionalmente omitido → novo orçamento
        // não fica vinculado ao pedido do original
      }
      const extraPayload = {
        payment_method:  b.payment_method ?? null,
        pay_condition:   b.pay_condition ?? null,
        installments:    b.installments ?? null,
        signal_amount:   b.signal_amount ?? null,
        prazo_type:      b.prazo_type ?? null,
        prazo_dias:      b.prazo_dias ?? null,
        prazo_due_date:  b.prazo_due_date ?? null,
        delivery_type:   b.delivery_type ?? null,
        delivery_fee:    b.delivery_fee ?? 0,
        delivery_addr:   b.delivery_addr ?? null,
        delivery_days:   b.delivery_days ?? null,
        production_days: b.production_days ?? null,
      }

      let insRes: any = await (supabase.from('budgets') as any)
        .insert([{ ...basePayload, ...extraPayload }]).select('id').single()
      if (insRes?.error?.code === '42703') {
        insRes = await (supabase.from('budgets') as any)
          .insert([basePayload]).select('id').single()
      }
      if (insRes?.error) throw insRes.error
      const newBudget = insRes.data
      createdBudgetId = newBudget?.id ?? null

      // 3. Duplicar itens — novos registros apontando para o novo orçamento
      if ((bi ?? []).length > 0 && newBudget?.id) {
        const rows = (bi as any[]).map(
          ({ id: _iid, budget_id: _bid, created_at: _ic, updated_at: _iu, ...item }) => ({
            ...item,
            budget_id: newBudget.id,
          })
        )
        const { error: itemsErr } = await (supabase.from('budget_items') as any).insert(rows)
        if (itemsErr) throw itemsErr
      }

      qc.invalidateQueries({ queryKey: ['budgets', companyId] })
      toast('success', 'Orçamento duplicado com sucesso!')

      // 4. Abrir o novo orçamento em modo edição
      const { data: fullNew } = await (supabase.from('budgets') as any)
        .select('*,customers(name,email,phone,city,state,cpf_cnpj)')
        .eq('id', newBudget.id).single()
      if (fullNew) openEdit(fullNew)
    } catch (err: unknown) {
      // Rollback: evita orçamento órfão/incompleto se a cópia dos itens falhar
      if (createdBudgetId) {
        await (supabase.from('budgets') as any).delete().eq('id', createdBudgetId)
        qc.invalidateQueries({ queryKey: ['budgets', companyId] })
      }
      console.error('[handleDuplicateBudget] falha ao duplicar orçamento', err)
      toast('error', 'Não foi possível duplicar o orçamento. Tente novamente.')
    } finally {
      setDuplicatingBudget(null)
    }
  }

  return(
    <div className="page-enter">
      <Header title="Orçamentos" subtitle="Crie e envie orçamentos profissionais"/>
      <div className="p-3 sm:p-5 lg:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-text-secondary dark:text-stone-400">{budgets?.length??0} orçamento{budgets?.length!==1?'s':''}</p>
          <button onClick={openWizard} className="btn-primary flex items-center gap-2 flex-shrink-0"><Plus size={16}/>Novo Orçamento</button>
        </div>

        {/* ── Card informativo fiscal ── */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200/40 dark:border-amber-700/25 bg-amber-50/50 dark:bg-amber-900/10">
          <Info size={15} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            <span className="font-semibold">Documento comercial: </span>
            Este orçamento não possui validade fiscal como Nota Fiscal.
            A emissão de NF deve ser realizada separadamente conforme a legislação vigente.
          </p>
        </div>
        <div className="card p-0 overflow-hidden">
          {isLoading?(<div className="p-6"><SkeletonTable rows={4}/></div>):!budgets?.length?(
            <EmptyState icon={FileText} title="Nenhum orçamento ainda" description="Crie orçamentos profissionais com PDF para enviar aos seus clientes." action={{label:'+ Novo Orçamento',onClick:openWizard}}/>
          ):(
            <>
              <div className="md:hidden divide-y divide-border dark:divide-border-dark">
                {budgets.map((b:any)=>{
                  const cfg=STATUS_CONFIG[b.status]??STATUS_CONFIG.draft
                  return(
                    <div key={b.id} className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-xs font-mono text-primary">{b.budget_number||'—'}</p>
                          <p className="text-sm font-semibold text-text-primary dark:text-stone-100 mt-0.5">{(b.customers as any)?.name??'Sem cliente'}</p>
                          {/* Badge de pedido vinculado */}
                          {b.converted_to_order_id && (
                            <a href="/pedidos" className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-success-dark dark:text-success bg-success-light dark:bg-success/10 px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity">
                              <CheckCircle size={9}/> Pedido criado
                            </a>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-primary">{fmt(Number(b.total))}</p>
                          <span className={clsx('text-[10px] font-medium px-2 py-0.5 rounded-full',cfg.badge)}>{cfg.label}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={()=>openEdit(b)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl border border-border dark:border-border-dark hover:border-primary hover:text-primary transition-all">
                          <Edit2 size={12}/>Editar
                        </button>
                        <button onClick={()=>handleGeneratePDF(b)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl border border-border dark:border-border-dark hover:border-primary hover:text-primary transition-all">
                          {generating?<Loader2 size={12} className="animate-spin"/>:<Download size={12}/>}PDF
                        </button>
                        <button
                          onClick={()=>handleDuplicateBudget(b)}
                          disabled={duplicatingBudget===b.id}
                          className="p-2 rounded-xl text-text-muted hover:text-info hover:bg-info-light transition-colors" title="Duplicar">
                          {duplicatingBudget===b.id?<Loader2 size={14} className="animate-spin"/>:<Copy size={14}/>}
                        </button>
                        {/* Botão Aprovar → Pedido */}
                        {!b.converted_to_order_id && b.status !== 'rejected' && (
                          <button
                            onClick={()=>handleConvertToOrder(b)}
                            disabled={converting===b.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl border border-success/40 text-success-dark dark:text-success bg-success-light dark:bg-success/10 hover:bg-success/20 transition-all disabled:opacity-60">
                            {converting===b.id?<Loader2 size={12} className="animate-spin"/>:<ShoppingBag size={12}/>}
                            {converting===b.id?'Criando...':'→ Pedido'}
                          </button>
                        )}
                        <button onClick={()=>setDeleteId(b.id)} className="p-2 rounded-xl text-text-muted hover:text-error hover:bg-error-light transition-colors"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full">
                  <thead><tr className="border-b border-border dark:border-border-dark">
                    {['Número','Cliente','Status','Total','Validade','Ações'].map(h=>(
                      <th key={h} className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider p-4">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {budgets.map((b:any)=>{
                      const cfg=STATUS_CONFIG[b.status]??STATUS_CONFIG.draft
                      const Ic=cfg.icon
                      return(
                        <tr key={b.id} className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/20 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="p-4 text-sm font-mono text-primary">{b.budget_number||'—'}</td>
                          <td className="p-4">
                            <p className="text-sm text-text-primary dark:text-stone-100">{(b.customers as any)?.name??'—'}</p>
                            {b.converted_to_order_id && (
                              <a href="/pedidos" className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-medium text-success-dark dark:text-success hover:opacity-80">
                                <CheckCircle size={9}/> Pedido vinculado
                              </a>
                            )}
                          </td>
                          <td className="p-4"><span className={clsx('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',cfg.badge)}><Ic size={11}/>{cfg.label}</span></td>
                          <td className="p-4 text-sm font-bold text-primary">{fmt(Number(b.total))}</td>
                          <td className="p-4 text-sm text-text-secondary dark:text-stone-300">{b.valid_until?format(new Date(b.valid_until),'dd/MM/yyyy',{locale:ptBR}):'—'}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <button onClick={()=>openEdit(b)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors" title="Editar">
                                <Edit2 size={14}/>
                              </button>
                              <button onClick={()=>handleGeneratePDF(b)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors" title="PDF">
                                {generating?<Loader2 size={14} className="animate-spin"/>:<Download size={14}/>}
                              </button>
                              <button onClick={()=>handleDuplicateBudget(b)} disabled={duplicatingBudget===b.id}
                                className="p-1.5 rounded-lg text-text-muted hover:text-info hover:bg-info-light transition-colors" title="Duplicar">
                                {duplicatingBudget===b.id?<Loader2 size={14} className="animate-spin"/>:<Copy size={14}/>}
                              </button>
                              {/* Botão Aprovar → Pedido */}
                              {!b.converted_to_order_id && b.status !== 'rejected' ? (
                                <button
                                  onClick={()=>handleConvertToOrder(b)}
                                  disabled={converting===b.id}
                                  title="Aprovar e criar pedido"
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-success-dark dark:text-success bg-success-light dark:bg-success/10 hover:bg-success/20 transition-all disabled:opacity-60">
                                  {converting===b.id?<Loader2 size={12} className="animate-spin"/>:<ShoppingBag size={12}/>}
                                  {converting===b.id?'…':'Aprovar'}
                                </button>
                              ) : b.converted_to_order_id ? (
                                <a href="/pedidos" title="Ver pedido" className="p-1.5 rounded-lg text-success hover:bg-success-light transition-colors">
                                  <ExternalLink size={14}/>
                                </a>
                              ) : null}
                              <button onClick={()=>setDeleteId(b.id)} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors" title="Excluir"><Trash2 size={14}/></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {showWizard&&(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setShowWizard(false)}/>
          <div className="relative bg-white dark:bg-[#1C1714] w-full sm:max-w-2xl max-h-[96dvh] sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-[0_32px_64px_rgba(0,0,0,0.4)] overflow-hidden">

            {/* Header + stepper */}
            <div className="flex-shrink-0 px-4 sm:px-6 pt-4 pb-3 border-b border-border dark:border-stone-800">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-text-primary dark:text-stone-100">{editingBudgetId?"Editar Orçamento":"Novo Orçamento"}</h2>
                <button onClick={()=>setShowWizard(false)} className="p-1.5 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted transition-colors"><X size={16}/></button>
              </div>
              <div className="flex items-center gap-1">
                {STEP_META.map(({step:s,label,icon:Ic})=>(
                  <button key={s} onClick={()=>{if(s<step)setStep(s)}}
                    className={clsx('flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-[10px] sm:text-xs font-medium transition-all',
                      step===s?'bg-primary text-white shadow-sm':s<step?'bg-primary-50 dark:bg-primary/15 text-primary cursor-pointer':'text-text-muted dark:text-stone-500')}>
                    <Ic size={12}/><span className="hidden sm:block">{label}</span><span className="sm:hidden">{s}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">

              {step===1&&(
                <div className="p-4 sm:p-6 space-y-4 animate-fadeIn">
                  <div>
                    <p className="text-sm font-bold text-text-primary dark:text-stone-100 mb-1">Para quem é este orçamento?</p>
                    <p className="text-xs text-text-muted dark:text-stone-500">Selecione ou adicione um cliente</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['existing','new']as const).map(mode=>(
                      <button key={mode} onClick={()=>setClientMode(mode)}
                        className={clsx('flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all',
                          clientMode===mode?'border-primary bg-primary-50 dark:bg-primary/10 text-primary':'border-border dark:border-stone-700 text-text-secondary dark:text-stone-400 hover:border-primary/50')}>
                        <User size={15}/>{mode==='existing'?'Já cadastrado':'Novo cliente'}
                      </button>
                    ))}
                  </div>
                  {clientMode==='existing'?(
                    <div className="space-y-2">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"/>
                        <input type="text" className="input pl-9" placeholder="Buscar cliente..." value={clientSearch} onChange={e=>setClientSearch(e.target.value)}/>
                      </div>
                      <div className="max-h-52 overflow-y-auto rounded-xl border border-border dark:border-stone-700 divide-y divide-border dark:divide-stone-800">
                        {filteredCustomers.length===0?(<p className="text-xs text-text-muted text-center py-6">Nenhum cliente encontrado</p>
                        ):filteredCustomers.map((c:any)=>(
                          <button key={c.id} type="button" onClick={()=>setClientId(c.id)}
                            className={clsx('w-full text-left px-4 py-3 flex items-center gap-3 transition-all hover:bg-primary-50/50 dark:hover:bg-primary/5',clientId===c.id?'bg-primary-50 dark:bg-primary/10':'')}>
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">{c.name.charAt(0).toUpperCase()}</div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-text-primary dark:text-stone-100 leading-snug break-words">{c.name}</p>
                              {c.phone&&<p className="text-[10px] text-text-muted">{c.phone}</p>}
                            </div>
                            {clientId===c.id&&<CheckCircle size={15} className="text-primary flex-shrink-0"/>}
                          </button>
                        ))}
                      </div>
                    </div>
                  ):(
                    <div className="space-y-3 p-4 rounded-xl border border-border dark:border-stone-700 bg-primary-50/30 dark:bg-primary/5">
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Dados do novo cliente</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Nome *</label>
                          <input className="input" placeholder="Nome completo" value={newClient.name} onChange={e=>setNewClient(p=>({...p,name:e.target.value}))}/>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">WhatsApp</label>
                          <input className="input" placeholder="(11) 99999-9999" value={newClient.phone} onChange={e=>setNewClient(p=>({...p,phone:e.target.value}))}/>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">E-mail</label>
                          <input className="input" type="email" placeholder="email@exemplo.com" value={newClient.email} onChange={e=>setNewClient(p=>({...p,email:e.target.value}))}/>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step===2&&(
                <div className="p-4 sm:p-6 space-y-4 animate-fadeIn">
                  <div>
                    <p className="text-sm font-bold text-text-primary dark:text-stone-100">O que será orçado?</p>
                    <p className="text-xs text-text-muted dark:text-stone-500">Adicione produtos, serviços ou itens personalizados</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      {key:'product',label:'Produto',icon:Package,sub:'do catálogo'},
                      {key:'service',label:'Serviço',icon:FileText,sub:'personalizado'},
                      {key:'manual', label:'Manual', icon:Edit3,  sub:'item livre'},
                    ]).map(({key,label,icon:Ic,sub})=>(
                      <button key={key} type="button"
                        onClick={()=>{if(key==='product')setAddMode('product');else openNewItem(key as 'service'|'manual')}}
                        className={clsx('flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-center transition-all',
                          addMode===key?'border-primary bg-primary-50 dark:bg-primary/10':'border-border dark:border-stone-700 hover:border-primary/50 hover:bg-primary-50/30 dark:hover:bg-primary/5')}>
                        <Ic size={16} className="text-primary"/>
                        <span className="text-xs font-semibold text-text-primary dark:text-stone-100">{label}</span>
                        <span className="text-[10px] text-text-muted">{sub}</span>
                      </button>
                    ))}
                  </div>
                  {addMode==='product'&&(
                    <div className="rounded-xl border border-primary/30 bg-primary-50/30 dark:bg-primary/5 overflow-hidden">
                      <div className="p-3 border-b border-border dark:border-stone-800">
                        <div className="relative">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"/>
                          <input autoFocus className="input pl-9 py-2 text-sm" placeholder="Buscar produto..." value={prodSearch} onChange={e=>setProdSearch(e.target.value)}/>
                        </div>
                      </div>
                      <div className="max-h-44 overflow-y-auto divide-y divide-border dark:divide-stone-800">
                        {filteredProducts.length===0?(<p className="text-xs text-text-muted text-center py-4">Nenhum produto encontrado</p>
                        ):filteredProducts.map((p:any)=>(
                          <button key={p.id} type="button" onClick={()=>addItemFromProduct(p)}
                            className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-primary-50/50 dark:hover:bg-primary/10 transition-colors">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-text-primary dark:text-stone-100 leading-snug break-words">{p.name}</p>
                              <p className="text-[10px] text-text-muted">{p.category}</p>
                            </div>
                            <span className="text-sm font-bold text-primary flex-shrink-0">{fmt(Number(p.final_price))}</span>
                          </button>
                        ))}
                      </div>
                      <div className="p-2 flex justify-end border-t border-border dark:border-stone-800">
                        <button type="button" onClick={()=>setAddMode(null)} className="text-xs text-text-muted hover:text-primary transition-colors">Fechar</button>
                      </div>
                    </div>
                  )}
                  {items.length>0?(
                    <div className="space-y-2">
                      {items.map(item=>(
                        <div key={item.id} className="p-3.5 rounded-xl border border-border dark:border-stone-700 bg-white dark:bg-white/[0.02] hover:border-primary/40 transition-all group space-y-0">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-text-primary dark:text-stone-100 leading-snug break-words">{item.name||'Item sem nome'}</p>
                                  <p className="text-xs text-text-muted mt-0.5">{item.quantity}× {fmt(item.unit_price)}{item.discount>0&&<span className="ml-1 text-green-600 dark:text-green-400">−{item.discount}%</span>}</p>
                                </div>
                                <p className="text-sm font-bold text-primary flex-shrink-0">{fmt(item.subtotal)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity flex-shrink-0">
                              <button type="button" onClick={()=>setEditItem(item)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"><Edit3 size={13}/></button>
                              <button type="button" onClick={()=>removeItem(item.id)} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"><Trash2 size={13}/></button>
                            </div>
                          </div>
                          {editingBudgetId?(
                            <BudgetItemArtwork
                              budgetId={editingBudgetId}
                              budgetItemId={item.id}
                              file={filesByItem[item.id]??null}
                              onChanged={()=>refetchItemFiles()}
                            />
                          ):(
                            <p className="pt-2.5 mt-2.5 border-t border-border dark:border-stone-800 text-[11px] text-text-muted dark:text-stone-500 flex items-center gap-1.5">
                              <Paperclip size={11}/> Salve o orçamento para anexar arte a este item.
                            </p>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-primary-50/50 dark:bg-primary/5 border border-border dark:border-stone-700">
                        <span className="text-xs text-text-muted flex-1">Desconto global (R$)</span>
                        <input type="number" step="0.01" min="0" className="input w-28 text-sm text-right py-1.5" value={globalDisc} onChange={e=>setGlobalDisc(Number(e.target.value))}/>
                      </div>
                    </div>
                  ):(
                    <div className="text-center py-8 text-text-muted dark:text-stone-500">
                      <Package size={28} className="mx-auto mb-2 opacity-30"/>
                      <p className="text-sm">Nenhum item adicionado</p>
                      <p className="text-xs mt-0.5">Use os botões acima para adicionar</p>
                    </div>
                  )}
                  {items.length>0&&(
                    <div className="rounded-xl p-4 border border-primary/20 bg-primary-50/30 dark:bg-primary/5">
                      <div className="flex items-center justify-between text-sm"><span className="text-text-secondary dark:text-stone-400">Subtotal</span><span className="font-medium text-text-primary dark:text-stone-100">{fmt(subtotal)}</span></div>
                      {totalDisc>0&&<div className="flex items-center justify-between text-sm mt-1"><span className="text-green-600 dark:text-green-400">Desconto</span><span className="text-green-600 dark:text-green-400">−{fmt(totalDisc)}</span></div>}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border dark:border-stone-700"><span className="text-sm font-bold text-text-primary dark:text-stone-100">Total</span><span className="text-lg font-bold text-primary">{fmt(total)}</span></div>
                    </div>
                  )}
                </div>
              )}

              {step===3&&(
                <div className="p-4 sm:p-6 space-y-5 animate-fadeIn">
                  <div>
                    <p className="text-sm font-bold text-text-primary dark:text-stone-100">Como será o pagamento?</p>
                    <p className="text-xs text-text-muted dark:text-stone-500">Defina a forma e condição</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Forma de pagamento</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PAYMENT_OPTIONS.map(opt=>(
                        <button key={opt} type="button" onClick={()=>setPayMethod(opt)}
                          className={clsx('py-2.5 px-3 rounded-xl text-sm font-medium border transition-all',payMethod===opt?'border-primary bg-primary text-white':'border-border dark:border-stone-700 text-text-secondary dark:text-stone-400 hover:border-primary/50')}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Condição</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[{val:'avista',label:'À vista'},{val:'parcelado',label:'Parcelado'},{val:'entrada',label:'Entrada + Saldo'},{val:'prazo',label:'Prazo'}].map(({val,label})=>(
                        <button key={val} type="button" onClick={()=>setPayCond(val as typeof payCondition)}
                          className={clsx('py-2.5 px-3 rounded-xl text-sm font-medium border transition-all',payCondition===val?'border-primary bg-primary-50 dark:bg-primary/15 text-primary':'border-border dark:border-stone-700 text-text-secondary dark:text-stone-400 hover:border-primary/50')}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {payCondition==='parcelado'&&(
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-primary-50/50 dark:bg-primary/5 border border-border dark:border-stone-700">
                      <span className="text-sm text-text-secondary dark:text-stone-400">Parcelas</span>
                      <div className="flex items-center gap-2 ml-auto">
                        <button type="button" onClick={()=>setInstall(Math.max(2,installments-1))} className="w-7 h-7 rounded-lg border border-border dark:border-stone-600 flex items-center justify-center hover:border-primary transition-colors"><Minus size={12}/></button>
                        <span className="text-sm font-bold text-primary w-6 text-center">{installments}x</span>
                        <button type="button" onClick={()=>setInstall(Math.min(24,installments+1))} className="w-7 h-7 rounded-lg border border-border dark:border-stone-600 flex items-center justify-center hover:border-primary transition-colors"><Plus size={12}/></button>
                      </div>
                      <span className="text-sm font-bold text-primary">{fmt(total/installments)}/mês</span>
                    </div>
                  )}
                  {payCondition==='entrada'&&(()=>{
                    // Calcular valores derivados em tempo real
                    const entradaVal = signalMode==='percent'
                      ? Math.round(total * (signalPct/100) * 100) / 100
                      : signalAmt
                    const entradaPct = total > 0
                      ? Math.round((entradaVal/total)*100*10)/10
                      : 0
                    const restante = Math.max(0, total - entradaVal)
                    return (
                      <div className="p-4 rounded-xl bg-primary-50/50 dark:bg-primary/5 border border-primary/20 space-y-3">
                        {/* Toggle R$ / % */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider flex-1">Tipo de entrada</span>
                          <div className="flex rounded-xl border border-border dark:border-stone-600 overflow-hidden">
                            <button type="button"
                              onClick={()=>{ setSignalMode('value'); setSignalAmt(Math.round(total*(signalPct/100)*100)/100) }}
                              className={clsx('px-3 py-1.5 text-xs font-semibold transition-all', signalMode==='value'?'bg-primary text-white':'text-text-secondary dark:text-stone-400 hover:bg-primary-50 dark:hover:bg-white/5')}>
                              R$
                            </button>
                            <button type="button"
                              onClick={()=>{ setSignalMode('percent'); setSignalPct(total>0?Math.round((signalAmt/total)*100):50) }}
                              className={clsx('px-3 py-1.5 text-xs font-semibold transition-all', signalMode==='percent'?'bg-primary text-white':'text-text-secondary dark:text-stone-400 hover:bg-primary-50 dark:hover:bg-white/5')}>
                              %
                            </button>
                          </div>
                        </div>
                        {/* Input */}
                        {signalMode==='value' ? (
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-text-secondary dark:text-stone-400 flex-1">Valor da entrada</span>
                            <div className="relative w-36">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-muted font-medium">R$</span>
                              <input type="number" step="0.01" min="0" max={total}
                                className="input pl-8 text-sm text-right py-1.5"
                                value={signalAmt||''}
                                onChange={e=>{
                                  const v=Math.max(0,Math.min(total,Number(e.target.value)||0))
                                  setSignalAmt(v)
                                  if(total>0) setSignalPct(Math.round((v/total)*100*10)/10)
                                }}/>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-text-secondary dark:text-stone-400 flex-1">Percentual da entrada</span>
                            <div className="flex items-center gap-2">
                              {/* Atalhos rápidos */}
                              {[25,30,50,70].map(p=>(
                                <button key={p} type="button"
                                  onClick={()=>{ setSignalPct(p); setSignalAmt(Math.round(total*(p/100)*100)/100) }}
                                  className={clsx('text-[10px] font-bold px-2 py-1 rounded-lg border transition-all',
                                    signalPct===p?'border-primary bg-primary text-white':'border-border dark:border-stone-600 text-text-muted hover:border-primary hover:text-primary')}>
                                  {p}%
                                </button>
                              ))}
                              <div className="relative w-24">
                                <input type="number" step="1" min="1" max="99"
                                  className="input text-sm text-right py-1.5 pr-6"
                                  value={signalPct||''}
                                  onChange={e=>{
                                    const v=Math.max(1,Math.min(99,Number(e.target.value)||0))
                                    setSignalPct(v)
                                    setSignalAmt(Math.round(total*(v/100)*100)/100)
                                  }}/>
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">%</span>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Resumo visual — condição de pagamento acordada, NÃO um recebimento */}
                        <div className="rounded-xl overflow-hidden border border-primary/15">
                          <div className="flex items-center justify-between px-3 py-2 bg-primary-50/60 dark:bg-primary/5">
                            <span className="flex flex-col">
                              <span className="text-xs font-semibold text-text-primary dark:text-stone-100">Entrada ({entradaPct}%)</span>
                              <span className="text-[10px] text-text-muted dark:text-stone-400">A pagar antecipadamente</span>
                            </span>
                            <span className="text-sm font-bold text-text-primary dark:text-stone-100">{fmt(entradaVal)}</span>
                          </div>
                          <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-surface-dark border-t border-primary/10">
                            <span className="flex flex-col">
                              <span className="text-xs font-semibold text-text-primary dark:text-stone-100">Saldo restante ({Math.round((100-entradaPct)*10)/10}%)</span>
                              <span className="text-[10px] text-text-muted dark:text-stone-400">A pagar posteriormente</span>
                            </span>
                            <span className="text-sm font-bold text-primary">{fmt(restante)}</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-text-muted dark:text-stone-400 leading-snug">
                          Isto define <span className="font-semibold">como</span> o cliente vai pagar. O recebimento só é
                          registrado no financeiro quando você lançar o pagamento no pedido.
                        </p>
                      </div>
                    )
                  })()}
                  {payCondition==='prazo'&&(()=>{
                    const vencDate=prazoVencimento(issueDate,prazoDays)
                    const equivDays=prazoEquivDays(issueDate,prazoDate)
                    const todayStr=format(new Date(),'yyyy-MM-dd')
                    return (
                      <div className="p-4 rounded-xl bg-primary-50/50 dark:bg-primary/5 border border-primary/20 space-y-3">
                        <div className="flex rounded-xl border border-border dark:border-stone-600 overflow-hidden w-fit">
                          <button type="button" onClick={()=>setPrazoType('dias')}
                            className={clsx('px-3 py-1.5 text-xs font-semibold transition-all',prazoType==='dias'?'bg-primary text-white':'text-text-secondary dark:text-stone-400 hover:bg-primary-50 dark:hover:bg-white/5')}>
                            Informar em dias
                          </button>
                          <button type="button" onClick={()=>setPrazoType('data')}
                            className={clsx('px-3 py-1.5 text-xs font-semibold transition-all',prazoType==='data'?'bg-primary text-white':'text-text-secondary dark:text-stone-400 hover:bg-primary-50 dark:hover:bg-white/5')}>
                            Escolher data
                          </button>
                        </div>
                        {prazoType==='dias' ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {[7,15,30,45,60,90].map(d=>(
                                <button key={d} type="button" onClick={()=>setPrazoDays(d)}
                                  className={clsx('text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all',
                                    prazoDays===d?'border-primary bg-primary text-white':'border-border dark:border-stone-600 text-text-muted hover:border-primary hover:text-primary')}>
                                  {d} dias
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-text-secondary dark:text-stone-400 flex-1">Prazo (dias)</span>
                              <input type="number" min="1" step="1" className="input w-24 text-sm text-right py-1.5"
                                value={prazoDays||''}
                                onChange={e=>setPrazoDays(Math.max(1,Number(e.target.value)||1))}/>
                            </div>
                            <div className="rounded-xl overflow-hidden border border-primary/15">
                              <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-surface-dark">
                                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Vencimento</span>
                                <span className="text-sm font-bold text-primary">{format(vencDate,"dd/MM/yyyy (EEEE)",{locale:ptBR})}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Data de vencimento</label>
                              <input type="date" min={todayStr} className="input text-sm"
                                value={prazoDate}
                                onChange={e=>setPrazoDate(e.target.value)}/>
                            </div>
                            {prazoDate&&(
                              <div className="rounded-xl overflow-hidden border border-primary/15">
                                <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-surface-dark">
                                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Prazo equivalente</span>
                                  <span className="text-sm font-bold text-primary">{equivDays} {equivDays===1?'dia':'dias'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {step===4&&(
                <div className="p-4 sm:p-6 space-y-5 animate-fadeIn">
                  <div>
                    <p className="text-sm font-bold text-text-primary dark:text-stone-100">Entrega e prazos</p>
                    <p className="text-xs text-text-muted dark:text-stone-500">Como o pedido será entregue?</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {DELIVERY_OPTIONS.map(opt=>(
                      <button key={opt.value} type="button" onClick={()=>setDelivType(opt.value)}
                        className={clsx('flex items-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-all',deliveryType===opt.value?'border-primary bg-primary-50 dark:bg-primary/15 text-primary':'border-border dark:border-stone-700 text-text-secondary dark:text-stone-400 hover:border-primary/50')}>
                        <span>{opt.emoji}</span>{opt.label}
                      </button>
                    ))}
                  </div>
                  {deliveryType==='pickup'&&(()=>{
                    const pickupLines=companyPickupAddressLines(companyData as any)
                    return (
                    <div className="p-4 rounded-xl bg-primary-50/40 dark:bg-primary/5 border border-primary/20">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1.5">📍 Local de retirada</p>
                      {pickupLines.length>0?(
                        <>
                          <div className="text-sm text-text-primary dark:text-stone-100 leading-relaxed">
                            {pickupLines.map(l=><p key={l}>{l}</p>)}
                          </div>
                          <p className="text-[11px] text-text-muted dark:text-stone-500 mt-2">Endereço da sua empresa (Configurações) — o cliente retira o pedido aqui.</p>
                        </>
                      ):(
                        <>
                          <p className="text-xs text-text-secondary dark:text-stone-400">Cadastre o endereço da empresa em Configurações para utilizá-lo como local de retirada.</p>
                          <a href="/configuracoes" className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-primary hover:opacity-80">Configurar endereço →</a>
                        </>
                      )}
                    </div>
                    )
                  })()}
                  {deliveryType!=='pickup'&&(
                    <div className="space-y-3 p-4 rounded-xl bg-primary-50/30 dark:bg-primary/5 border border-border dark:border-stone-700">
                      <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Endereço de entrega</label><input className="input text-sm" placeholder="Rua, número, bairro..." value={deliveryAddr} onChange={e=>setDelivAddr(e.target.value)}/></div>
                      <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Taxa de entrega (R$)</label><input type="number" step="0.01" min="0" className="input text-sm" value={deliveryFee} onChange={e=>setDelivFee(Number(e.target.value))}/></div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Prazos</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">📅 Validade</label><input type="date" className="input text-sm" value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></div>
                      <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">🏭 Produção</label><input className="input text-sm" placeholder="Ex: 3 dias úteis" value={prodDays} onChange={e=>setProdDays(e.target.value)}/></div>
                      <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">🚚 Entrega</label><input className="input text-sm" placeholder="Ex: até 5 dias" value={delivDays} onChange={e=>setDelivDays(e.target.value)}/></div>
                    </div>
                  </div>
                </div>
              )}

              {step===5&&(
                <div className="p-4 sm:p-6 space-y-4 animate-fadeIn">
                  <div>
                    <p className="text-sm font-bold text-text-primary dark:text-stone-100">Revise e finalize</p>
                    <p className="text-xs text-text-muted dark:text-stone-500">Confira os dados antes de salvar</p>
                  </div>
                  <div className="space-y-2">
                    <div className="p-3.5 rounded-xl border border-border dark:border-stone-700 bg-white dark:bg-white/[0.02]">
                      <div className="flex items-center gap-2 mb-2"><User size={13} className="text-primary"/><span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Cliente</span></div>
                      <p className="text-sm font-medium text-text-primary dark:text-stone-100">{clientMode==='new'?newClient.name||'—':(customers??[]).find((c:any)=>c.id===clientId)?.name??'—'}</p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-border dark:border-stone-700 bg-white dark:bg-white/[0.02]">
                      <div className="flex items-center gap-2 mb-2"><Package size={13} className="text-primary"/><span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{items.length} item{items.length!==1?'s':''}</span></div>
                      <div className="space-y-1.5">
                        {items.map(item=>(
                          <div key={item.id}>
                            <div className="flex justify-between text-sm">
                              <span className="text-text-secondary dark:text-stone-400 break-words">{item.quantity}× {item.name}</span>
                              <span className="font-medium text-text-primary dark:text-stone-100 ml-2 flex-shrink-0">{fmt(item.subtotal)}</span>
                            </div>
                            {editingBudgetId&&(
                              filesByItem[item.id]?(
                                <p className="text-[11px] text-text-muted dark:text-stone-500 flex items-center gap-1"><Paperclip size={10}/> {filesByItem[item.id].file_name}</p>
                              ):(
                                <p className="text-[11px] text-warning-dark dark:text-warning flex items-center gap-1">⚠ Sem arte anexada</p>
                              )
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-primary/20 bg-primary-50/30 dark:bg-primary/5">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm"><span className="text-text-secondary dark:text-stone-400">Subtotal</span><span className="font-medium text-text-primary dark:text-stone-100">{fmt(subtotal)}</span></div>
                        {deliveryFee>0&&<div className="flex justify-between text-sm"><span className="text-text-secondary dark:text-stone-400">Entrega</span><span className="font-medium text-text-primary dark:text-stone-100">{fmt(deliveryFee)}</span></div>}
                        {totalDisc>0&&<div className="flex justify-between text-sm"><span className="text-green-600 dark:text-green-400">Desconto</span><span className="text-green-600 dark:text-green-400">−{fmt(totalDisc)}</span></div>}
                        <div className="flex justify-between pt-2 border-t border-border dark:border-stone-700"><span className="text-sm font-bold text-text-primary dark:text-stone-100">Total</span><span className="text-xl font-bold text-primary">{fmt(total)}</span></div>
                      </div>
                    </div>
                  </div>
                  <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1.5">Observações</label><textarea rows={3} className="input resize-none text-sm" placeholder="Condições, detalhes especiais..." value={notes} onChange={e=>setNotes(e.target.value)}/></div>
                  <div>
                    <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-2">Status inicial</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(STATUS_CONFIG).map(([key,cfg])=>(
                        <button key={key} type="button" onClick={()=>setStatus(key)}
                          className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',status===key?cfg.badge+' border-transparent':'border-border dark:border-stone-700 text-text-muted')}>
                          {key===status&&<CheckCircle size={10}/>}{cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 p-4 sm:p-5 border-t border-border dark:border-stone-800 flex gap-3">
              <button type="button" onClick={step===1?()=>setShowWizard(false):goPrev} className="btn-secondary flex items-center gap-1.5 flex-shrink-0 px-4">
                <ChevronLeft size={15}/>{step===1?'Cancelar':'Voltar'}
              </button>
              {step<5?(
                <button type="button" onClick={goNext} disabled={!canProceed()} className="btn-primary flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                  Continuar <ChevronRight size={15}/>
                </button>
              ):(
                <button type="button" onClick={()=>saveMutation.mutate()} disabled={saving||items.length===0} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving&&<Loader2 size={15} className="animate-spin"/>}{saving?'Salvando...':'Salvar orçamento'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {editItem&&(
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={()=>setEditItem(null)}/>
          <div className="relative bg-white dark:bg-surface-dark w-full sm:max-w-md rounded-2xl shadow-modal animate-scaleIn overflow-hidden">
            <div className="p-4 border-b border-border dark:border-border-dark flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-primary dark:text-stone-100">{editItem.type==='product'?'Editar produto':editItem.type==='service'?'Novo serviço':'Novo item'}</h3>
              <button onClick={()=>setEditItem(null)} className="p-1.5 rounded-xl hover:bg-primary-50 text-text-muted"><X size={15}/></button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto max-h-[70vh]">
              <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Nome *</label><input className="input" value={editItem.name} onChange={e=>setEditItem(p=>p?{...p,name:e.target.value}:null)}/></div>
              <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Descrição</label><input className="input text-sm" value={editItem.description} onChange={e=>setEditItem(p=>p?{...p,description:e.target.value}:null)}/></div>
              {/* ── Toggle modo de precificação (apenas itens manuais) ── */}
              {editItem.type==='manual'&&(
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Modo de precificação</label>
                  <div className="flex gap-2">
                    {(['fixed','square_meter'] as const).map(mode=>(
                      <button key={mode} type="button"
                        onClick={()=>setEditItem(p=>p?{...p,pricing_mode:mode}:null)}
                        className={clsx('flex-1 py-2 rounded-xl text-xs font-semibold border transition-all',
                          (editItem.pricing_mode??'fixed')===mode
                            ?'border-primary bg-primary text-white'
                            :'border-border dark:border-stone-700 text-text-secondary dark:text-stone-400 hover:border-primary/50')}>
                        {mode==='fixed'?'💰 Valor fixo':'📐 Calcular por m²'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── MODO: VALOR FIXO ── */}
              {(editItem.pricing_mode??'fixed')!=='square_meter'&&(
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Qtd</label><input type="number" min="1" step="1" className="input text-sm" value={editItem.quantity} onChange={e=>setEditItem(p=>p?{...p,quantity:Number(e.target.value)}:null)}/></div>
                    <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Valor unit.</label><input type="number" step="0.01" className="input text-sm" value={editItem.unit_price} onChange={e=>setEditItem(p=>p?{...p,unit_price:Number(e.target.value)}:null)}/></div>
                    <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Desc. %</label><input type="number" min="0" max="100" className="input text-sm" value={editItem.discount} onChange={e=>setEditItem(p=>p?{...p,discount:Number(e.target.value)}:null)}/></div>
                  </div>
                  {/* Dimensões (opcional no modo fixo) */}
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Dimensões (opcional)</label>
                    <div className="mb-2">
                      <div className="flex gap-2">
                        {['mm','cm','m'].map(u=>(
                          <button key={u} type="button"
                            onClick={()=>setEditItem(p=>p?{...p,measurement_unit:u,area:p.width&&p.height?calculateAreaM2(p.width,p.height,u):undefined}:null)}
                            className={clsx('flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                              (editItem.measurement_unit??'m')===u
                                ?'border-primary bg-primary text-white'
                                :'border-border dark:border-stone-700 text-text-secondary dark:text-stone-400 hover:border-primary/50')}>
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Largura ({editItem.measurement_unit??'m'})</label>
                        <input type="number" min="0" step="0.01" className="input text-sm" placeholder="Ex: 100"
                          value={editItem.width??''}
                          onChange={e=>{
                            const w=parseFloat(e.target.value)||undefined
                            const u=editItem.measurement_unit??'m'
                            setEditItem(p=>p?{...p,width:w,area:w&&p.height?calculateAreaM2(w,p.height,u):undefined}:null)
                          }}/>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Altura ({editItem.measurement_unit??'m'})</label>
                        <input type="number" min="0" step="0.01" className="input text-sm" placeholder="Ex: 30"
                          value={editItem.height??''}
                          onChange={e=>{
                            const h=parseFloat(e.target.value)||undefined
                            const u=editItem.measurement_unit??'m'
                            setEditItem(p=>p?{...p,height:h,area:p.width&&h?calculateAreaM2(p.width,h,u):undefined}:null)
                          }}/>
                      </div>
                    </div>
                    {editItem.width&&editItem.height&&editItem.width>0&&editItem.height>0&&(()=>{
                      const u=editItem.measurement_unit??'m'
                      const block=getDimBlock(editItem.width,editItem.height,u,editItem.area)
                      const wFmt=block.wM.toFixed(4).replace('.',',')
                      const hFmt=block.hM.toFixed(4).replace('.',',')
                      return(
                        <div className="mt-2 rounded-xl bg-primary-50/60 dark:bg-primary/10 border border-primary/20 overflow-hidden">
                          <div className="px-3 py-2.5 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-semibold text-primary/50 uppercase tracking-wider mb-0.5">Dimensões</p>
                              <p className="text-sm font-bold text-primary">{block.original}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-semibold text-primary/50 uppercase tracking-wider mb-0.5">Área</p>
                              <p className="text-base font-bold text-primary">{block.area} m²</p>
                            </div>
                          </div>
                          {block.meters&&(
                            <details className="border-t border-primary/10">
                              <summary className="px-3 py-1.5 text-[11px] text-primary/60 cursor-pointer select-none list-none flex items-center gap-1">
                                <span className="text-[9px]">▶</span> Ver detalhes do cálculo
                              </summary>
                              <div className="px-3 pb-2.5 space-y-1.5 bg-primary/5">
                                <div><p className="text-[10px] font-semibold text-primary/50 uppercase tracking-wider">Conversão</p><p className="text-xs text-primary/80">{block.meters}</p></div>
                                <div><p className="text-[10px] font-semibold text-primary/50 uppercase tracking-wider">Fórmula</p><p className="text-xs text-primary/70">{wFmt} × {hFmt} = <span className="font-semibold text-primary">{block.area} m²</span></p></div>
                              </div>
                            </details>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </>
              )}

              {/* ── MODO: CALCULAR POR M² ── */}
              {(editItem.pricing_mode??'fixed')==='square_meter'&&(()=>{
                const u=editItem.measurement_unit??'m'
                const w=editItem.width, h=editItem.height
                const ppm2=editItem.price_per_m2??0
                const area=w&&h&&w>0&&h>0?calculateAreaM2(w,h,u):0
                const unitPrice=area*ppm2
                const subtotalPreview=unitPrice*editItem.quantity*(1-editItem.discount/100)
                const block=w&&h&&w>0&&h>0?getDimBlock(w,h,u,area):null
                return(
                  <>
                    {/* Unidade */}
                    <div>
                      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Unidade</label>
                      <div className="flex gap-2">
                        {(['mm','cm','m'] as const).map(un=>(
                          <button key={un} type="button"
                            onClick={()=>setEditItem(p=>p?applySquareMeterCalc(p,{measurement_unit:un}):null)}
                            className={clsx('flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                              u===un
                                ?'border-primary bg-primary text-white'
                                :'border-border dark:border-stone-700 text-text-secondary dark:text-stone-400 hover:border-primary/50')}>
                            {un}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Largura × Altura */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Largura ({u})</label>
                        <input type="number" min="0" step="0.01" className="input text-sm" placeholder="Ex: 100"
                          value={editItem.width??''}
                          onChange={e=>setEditItem(p=>p?applySquareMeterCalc(p,{width:parseFloat(e.target.value)||undefined}):null)}/>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Altura ({u})</label>
                        <input type="number" min="0" step="0.01" className="input text-sm" placeholder="Ex: 30"
                          value={editItem.height??''}
                          onChange={e=>setEditItem(p=>p?applySquareMeterCalc(p,{height:parseFloat(e.target.value)||undefined}):null)}/>
                      </div>
                    </div>
                    {/* Valor por m² */}
                    <div>
                      <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Valor por m² (R$)</label>
                      <input type="number" min="0" step="0.01" className="input text-sm" placeholder="Ex: 80,00"
                        value={editItem.price_per_m2??''}
                        onChange={e=>setEditItem(p=>p?applySquareMeterCalc(p,{price_per_m2:parseFloat(e.target.value)||undefined}):null)}/>
                    </div>
                    {/* Qtd + Desconto */}
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Quantidade</label><input type="number" min="1" step="1" className="input text-sm" value={editItem.quantity} onChange={e=>setEditItem(p=>p?{...p,quantity:Number(e.target.value)}:null)}/></div>
                      <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Desconto %</label><input type="number" min="0" max="100" className="input text-sm" value={editItem.discount} onChange={e=>setEditItem(p=>p?{...p,discount:Number(e.target.value)}:null)}/></div>
                    </div>
                    {/* Preview do cálculo */}
                    {block&&ppm2>0&&(
                      <div className="rounded-xl border border-primary/20 bg-primary-50/60 dark:bg-primary/10 overflow-hidden">
                        <div className="px-3 py-2 border-b border-primary/10">
                          <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Resumo do cálculo</p>
                        </div>
                        <div className="px-3 py-2.5 space-y-1.5">
                          <div className="flex justify-between items-baseline">
                            <span className="text-[11px] text-text-muted">Medidas</span>
                            <span className="text-xs font-medium text-text-primary dark:text-stone-200">{block.original}</span>
                          </div>
                          {block.meters&&(
                            <div className="flex justify-between items-baseline">
                              <span className="text-[11px] text-text-muted">Em metros</span>
                              <span className="text-xs text-text-secondary">{block.meters}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-baseline">
                            <span className="text-[11px] text-text-muted">Área</span>
                            <span className="text-xs font-semibold text-text-primary dark:text-stone-200">{block.wM.toFixed(4).replace('.',',')} × {block.hM.toFixed(4).replace('.',',')} = <span className="text-primary font-bold">{block.area} m²</span></span>
                          </div>
                          <div className="flex justify-between items-baseline">
                            <span className="text-[11px] text-text-muted">Valor do m²</span>
                            <span className="text-xs text-text-secondary">{fmt(ppm2)}</span>
                          </div>
                          <div className="flex justify-between items-baseline border-t border-primary/10 pt-1.5">
                            <span className="text-[11px] font-semibold text-text-primary dark:text-stone-200">Preço/peça</span>
                            <span className="text-sm font-bold text-primary">{fmt(unitPrice)}</span>
                          </div>
                          {editItem.quantity>1&&(
                            <>
                              <div className="flex justify-between items-baseline">
                                <span className="text-[11px] text-text-muted">Quantidade</span>
                                <span className="text-xs text-text-secondary">× {editItem.quantity}</span>
                              </div>
                              {editItem.discount>0&&(
                                <div className="flex justify-between items-baseline">
                                  <span className="text-[11px] text-text-muted">Desconto</span>
                                  <span className="text-xs text-text-secondary">− {editItem.discount}%</span>
                                </div>
                              )}
                              <div className="flex justify-between items-baseline border-t border-primary/10 pt-1.5">
                                <span className="text-[11px] font-bold text-text-primary dark:text-stone-200">Subtotal</span>
                                <span className="text-base font-bold text-primary">{fmt(subtotalPreview)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
              {/* Acabamentos */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Acabamentos</label>
                <div className="flex flex-wrap gap-1.5">
                  {['Laminação Fosca','Laminação Brilho','Recorte eletrônico','Corte reto','Ilhós','Bastão','Bainha','Cantos arredondados','Vinco','Dobra','Furação','Refile'].map(opt=>{
                    const active=(editItem.finishings??[]).includes(opt)
                    return(
                      <button key={opt} type="button"
                        onClick={()=>setEditItem(p=>p?{...p,finishings:active?(p.finishings??[]).filter(f=>f!==opt):[...(p.finishings??[]),opt]}:null)}
                        className={clsx('px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all',
                          active?'border-primary bg-primary text-white':'border-border dark:border-stone-700 text-text-secondary dark:text-stone-400 hover:border-primary/50')}>
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Finalização */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Finalização</label>
                <div className="flex flex-wrap gap-1.5">
                  {FINISHING_TYPE_OPTIONS.map(opt=>{
                    const ftVal=editItem.finishing_type??''
                    const isOthersSelected=ftVal.startsWith('Outros')
                    const active=opt==='Outros'?isOthersSelected:ftVal===opt
                    return(
                      <button key={opt} type="button"
                        onClick={()=>{
                          if(opt==='Outros'){
                            setEditItem(p=>p?{...p,finishing_type:isOthersSelected?'':'Outros: '}:null)
                          }else{
                            setEditItem(p=>p?{...p,finishing_type:active?'':opt}:null)
                          }
                        }}
                        className={clsx('px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all',
                          active?'border-primary bg-primary text-white':'border-border dark:border-stone-700 text-text-secondary dark:text-stone-400 hover:border-primary/50')}>
                        {opt}
                      </button>
                    )
                  })}
                </div>
                {(editItem.finishing_type??'').startsWith('Outros')&&(
                  <input
                    className="input text-sm mt-2"
                    placeholder="Descreva a finalização... ex: Separado em kits de 10 unidades"
                    value={(editItem.finishing_type??'').replace(/^Outros:\s*/,'')}
                    onChange={e=>setEditItem(p=>p?{...p,finishing_type:'Outros: '+e.target.value}:null)}
                  />
                )}
              </div>
              {/* Observações Técnicas */}
              <div>
                <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Obs. Técnicas</label>
                <textarea className="input text-sm resize-none" rows={2}
                  placeholder="Ex: Impressão CMYK, sangria 3mm..."
                  value={editItem.technical_notes??''}
                  onChange={e=>setEditItem(p=>p?{...p,technical_notes:e.target.value}:null)}/>
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-primary-50/50 dark:bg-primary/5">
                <span className="text-xs text-text-muted">Subtotal</span>
                <span className="text-sm font-bold text-primary">{fmt(editItem.unit_price*editItem.quantity*(1-editItem.discount/100))}</span>
              </div>
            </div>
            <div className="p-4 flex gap-3 border-t border-border dark:border-border-dark">
              <button onClick={()=>setEditItem(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={()=>saveEditItem(editItem)} disabled={!editItem.name.trim()} className="btn-primary flex-1 disabled:opacity-50">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {deleteId&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>setDeleteId(null)}/>
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm animate-scaleIn p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-error-light flex items-center justify-center mx-auto mb-4"><Trash2 size={20} className="text-error"/></div>
            <h3 className="text-base font-semibold text-text-primary dark:text-stone-100 mb-2">Excluir orçamento?</h3>
            <p className="text-sm text-text-secondary dark:text-stone-400 mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={()=>setDeleteId(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={()=>deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-error hover:opacity-90 disabled:opacity-50">
                {deleteMutation.isPending&&<Loader2 size={14} className="animate-spin"/>}Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
