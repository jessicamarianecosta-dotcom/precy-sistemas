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
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  FileText, Plus, X, Loader2, Trash2, Download,
  CheckCircle, XCircle, Clock, Send, ChevronRight,
  ChevronLeft, User, Package, CreditCard, Truck,
  Eye, Search, Edit3, Edit2, Minus, Info,
} from 'lucide-react'

interface BudgetItem {
  id: string; type: 'product'|'service'|'manual'; name: string
  description: string; quantity: number; unit_price: number
  discount: number; subtotal: number; product_id?: string
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
function fmt(v:number){ return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0) }
function uid(){ return Math.random().toString(36).slice(2,10) }

const STEP_META=[
  {step:1,label:'Cliente',  icon:User      },
  {step:2,label:'Itens',    icon:Package   },
  {step:3,label:'Pagamento',icon:CreditCard},
  {step:4,label:'Entrega',  icon:Truck     },
  {step:5,label:'Revisão',  icon:Eye       },
] as const

const PAYMENT_OPTIONS=['PIX','Dinheiro','Cartão crédito','Cartão débito','Boleto','Transferência','Parcelado']
const DELIVERY_OPTIONS=[
  {value:'pickup',   label:'Retirada',      emoji:'🏪'},
  {value:'delivery', label:'Entrega',        emoji:'🚗'},
  {value:'motoboy',  label:'Motoboy',        emoji:'🏍️'},
  {value:'correios', label:'Correios',       emoji:'📦'},
  {value:'carrier',  label:'Transportadora', emoji:'🚚'},
]

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
  const [deliveryType,setDelivType]=useState('pickup')
  const [deliveryFee,setDelivFee]=useState(0)
  const [deliveryAddr,setDelivAddr]=useState('')
  const [validUntil,setValidUntil]=useState('')
  const [prodDays,setProdDays]=useState('')
  const [delivDays,setDelivDays]=useState('')
  const [notes,setNotes]=useState('')
  const [status,setStatus]=useState('draft')
  const [companyData,setCompanyData]=useState<Record<string,unknown>|null>(null)

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
      const r:any=await supabase.from('products').select('id,name,final_price,category').eq('company_id',companyId!).eq('is_active',true).order('name')
      return r?.data??[]
    },
  })

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
    return true
  }
  function openWizard(){
    setEditingBudgetId(null)
    setStep(1);setItems([]);setClientId('');setClientSearch('');setNewClient({name:'',phone:'',email:''})
    setClientMode('existing');setGlobalDisc(0);setPayMethod('');setPayCond('avista')
    setDelivType('pickup');setDelivFee(0);setDelivAddr('');setValidUntil('')
    setProdDays('');setDelivDays('');setNotes('');setStatus('draft');setShowWizard(true)
  }

  async function openEdit(b:any){
    setEditingBudgetId(b.id)
    // Carregar itens do orçamento
    const {data:bi}=await(supabase.from('budget_items')as any).select('*').eq('budget_id',b.id)
    const loadedItems=(bi??[]).map((i:any)=>({
      id:i.id||uid(),type:'product' as const,
      name:i.product_name||i.name||'Item',description:i.description||'',
      quantity:Number(i.quantity)||1,unit_price:Number(i.unit_price)||0,
      discount:0,subtotal:Number(i.subtotal)||0,product_id:i.product_id||undefined,
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
    setPayCond('avista')
    // Entrega
    setDelivType('pickup');setDelivFee(0);setDelivAddr('')
    // Prazos
    setValidUntil(b.valid_until?b.valid_until.split('T')[0]:'')
    setProdDays('');setDelivDays('')
    // Notas + status
    setNotes(b.notes||'');setStatus(b.status||'draft')
    setStep(1);setShowWizard(true)
  }
  function addItemFromProduct(p:any){
    setItems(prev=>[...prev,{id:uid(),type:'product',name:p.name,description:'',quantity:1,unit_price:Number(p.final_price),discount:0,subtotal:Number(p.final_price),product_id:p.id}])
    setAddMode(null);setProdSearch('')
  }
  function openNewItem(type:'service'|'manual'){
    setEditItem({id:uid(),type,name:'',description:'',quantity:1,unit_price:0,discount:0,subtotal:0})
    setAddMode(null)
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
        signal_amount:   signalAmt>0?signalAmt:null,
        delivery_type:   deliveryType||null,
        delivery_fee:    deliveryFee||0,
        delivery_addr:   deliveryAddr||null,
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
        // Deletar itens antigos e reinserir
        await(supabase.from('budget_items')as any).delete().eq('budget_id',budgetId)
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
        await(supabase.from('budget_items')as any).insert(items.map(i=>({
          budget_id:budgetId,product_id:i.product_id||null,
          name:i.name||null,quantity:i.quantity,unit_price:i.unit_price,subtotal:i.subtotal,
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
      const{generateBudgetPDF}=await import('@/lib/pdf/generateBudgetPDF')

      // Buscar orçamento completo com cliente expandido
      const {data:fullBudget}=await(supabase.from('budgets')as any)
        .select('*,customers(id,name,email,phone,city,state,cpf_cnpj,address)')
        .eq('id',b.id).single()

      // Buscar itens com produto vinculado (para pegar nome se não salvo no item)
      const {data:bi}=await(supabase.from('budget_items')as any)
        .select('*,products(name,description,category)')
        .eq('budget_id',b.id)

      // Enriquecer itens: usar nome do produto se item não tem nome próprio
      const enrichedItems=(bi??[]).map((item:any)=>({
        ...item,
        name: item.name || item.products?.name || 'Item',
        description: item.description || item.products?.description || '',
      }))

      await generateBudgetPDF({
        budget: fullBudget??b,
        items:  enrichedItems,
        company:companyData,
      })
    }catch(err){
      console.error('[pdf]',err)
      toast('error','Erro ao gerar PDF.')
    }
    finally{setGenerating(false)}
  }

  return(
    <div className="page-enter">
      <Header title="Orçamentos" subtitle="Crie e envie orçamentos profissionais"/>
      <div className="p-3 sm:p-5 lg:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-text-secondary dark:text-stone-400">{budgets?.length??0} orçamento{budgets?.length!==1?'s':''}</p>
          <button onClick={openWizard} className="btn-primary flex items-center gap-2"><Plus size={16}/>Novo Orçamento</button>
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
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-primary">{fmt(Number(b.total))}</p>
                          <span className={clsx('text-[10px] font-medium px-2 py-0.5 rounded-full',cfg.badge)}>{cfg.label}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={()=>openEdit(b)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl border border-border dark:border-border-dark hover:border-primary hover:text-primary transition-all">
                          <Edit2 size={12}/>Editar
                        </button>
                        <button onClick={()=>handleGeneratePDF(b)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl border border-border dark:border-border-dark hover:border-primary hover:text-primary transition-all">
                          {generating?<Loader2 size={12} className="animate-spin"/>:<Download size={12}/>}PDF
                        </button>
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
                          <td className="p-4 text-sm text-text-primary dark:text-stone-100">{(b.customers as any)?.name??'—'}</td>
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
                              <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">{c.name}</p>
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
                              <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">{p.name}</p>
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
                        <div key={item.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-border dark:border-stone-700 bg-white dark:bg-white/[0.02] hover:border-primary/40 transition-all group">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-text-primary dark:text-stone-100 truncate">{item.name||'Item sem nome'}</p>
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
                  {payCondition==='entrada'&&(
                    <div className="p-3 rounded-xl bg-primary-50/50 dark:bg-primary/5 border border-border dark:border-stone-700 space-y-2">
                      <div className="flex items-center gap-3"><span className="text-sm text-text-secondary dark:text-stone-400 flex-1">Entrada (R$)</span><input type="number" step="0.01" min="0" className="input w-32 text-sm text-right py-1.5" value={signalAmt} onChange={e=>setSignalAmt(Number(e.target.value))}/></div>
                      <div className="flex items-center justify-between text-sm pt-1 border-t border-border dark:border-stone-700"><span className="text-text-muted">Saldo restante</span><span className="font-bold text-primary">{fmt(Math.max(0,total-signalAmt))}</span></div>
                    </div>
                  )}
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
                      <div className="space-y-1">
                        {items.slice(0,3).map(item=>(
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-text-secondary dark:text-stone-400 truncate">{item.quantity}× {item.name}</span>
                            <span className="font-medium text-text-primary dark:text-stone-100 ml-2 flex-shrink-0">{fmt(item.subtotal)}</span>
                          </div>
                        ))}
                        {items.length>3&&<p className="text-xs text-text-muted">+{items.length-3} outros itens</p>}
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
            <div className="p-4 space-y-3">
              <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Nome *</label><input className="input" value={editItem.name} onChange={e=>setEditItem(p=>p?{...p,name:e.target.value}:null)}/></div>
              <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Descrição</label><input className="input text-sm" value={editItem.description} onChange={e=>setEditItem(p=>p?{...p,description:e.target.value}:null)}/></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Qtd</label><input type="number" min="1" step="1" className="input text-sm" value={editItem.quantity} onChange={e=>setEditItem(p=>p?{...p,quantity:Number(e.target.value)}:null)}/></div>
                <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Valor unit.</label><input type="number" step="0.01" className="input text-sm" value={editItem.unit_price} onChange={e=>setEditItem(p=>p?{...p,unit_price:Number(e.target.value)}:null)}/></div>
                <div><label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Desc. %</label><input type="number" min="0" max="100" className="input text-sm" value={editItem.discount} onChange={e=>setEditItem(p=>p?{...p,discount:Number(e.target.value)}:null)}/></div>
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
