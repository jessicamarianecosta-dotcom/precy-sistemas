'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/hooks/useCompanyId'
import { useToast } from '@/components/ui/Toaster'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils/format'
import { clsx } from 'clsx'
import {
  ArrowLeft, Search, UserCheck, UserPlus, Package, Plus, Trash2, Loader2,
  AlertTriangle, FileText, Pencil,
} from 'lucide-react'
import { CompletarDestinatarioModal } from '@/components/notasFiscais/CompletarDestinatarioModal'
import { NotaFiscalExtrasForm, criarNfeExtrasPadrao, extrasParaPayload, type NfeExtrasState } from '@/components/notasFiscais/NotaFiscalExtrasForm'

interface AvulsaItem {
  tempId: string
  code: string
  name: string
  unit: string
  quantity: number
  unitPrice: number
  ncm: string
}

function uid() {
  return Math.random().toString(36).slice(2)
}

interface MissingField {
  field: string
  label: string
  where: 'empresa' | 'cliente' | 'produto'
  productName?: string
}

export default function NovaNotaAvulsaPage() {
  const supabase = createClient()
  const { companyId } = useCompanyId()
  const { toast } = useToast()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [naturezaOperacao, setNaturezaOperacao] = useState('Venda de mercadoria')
  const [extras, setExtras] = useState<NfeExtrasState>(criarNfeExtrasPadrao())

  // ── Destinatário ──
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    name: '', phone: '', email: '', cpf_cnpj: '', person_type: 'fisica' as 'fisica' | 'juridica',
    street: '', number: '', neighborhood: '', city: '', state: '', zip_code: '',
  })

  const { data: customers } = useQuery<any[]>({
    queryKey: ['notas_fiscais_avulsa_customers', companyId, customerSearch],
    enabled: !!companyId,
    queryFn: async () => {
      let query = (supabase.from('customers') as any)
        .select('id, name, phone, person_type, cpf_cnpj, street, number, complement, neighborhood, city, state, zip_code')
        .eq('company_id', companyId!)
        .order('name', { ascending: true })
        .limit(20)
      if (customerSearch) query = query.ilike('name', `%${customerSearch}%`)
      const { data } = await query
      return data ?? []
    },
  })

  const selectedCustomer = (customers ?? []).find(c => c.id === customerId)

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!newCustomer.name.trim()) throw new Error('Informe o nome do destinatário')
      const { data, error } = await (supabase.from('customers') as any)
        .insert([{
          company_id: companyId!,
          name: newCustomer.name.trim(),
          phone: newCustomer.phone || null,
          email: newCustomer.email || null,
          cpf_cnpj: newCustomer.cpf_cnpj || null,
          person_type: newCustomer.person_type,
          street: newCustomer.street || null,
          number: newCustomer.number || null,
          neighborhood: newCustomer.neighborhood || null,
          city: newCustomer.city || null,
          state: newCustomer.state || null,
          zip_code: newCustomer.zip_code || null,
          total_purchases: 0,
        }])
        .select('id, name')
        .single()
      if (error) throw new Error(error.message)
      return data as { id: string; name: string }
    },
    onSuccess: (created) => {
      setCustomerId(created.id)
      setCustomerSearch(created.name)
      setCustomerMode('existing')
      toast('success', 'Destinatário cadastrado e selecionado!')
    },
    onError: (err: Error) => toast('error', `Erro ao cadastrar destinatário: ${err.message}`),
  })

  // ── Itens ──
  const [items, setItems] = useState<AvulsaItem[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [showProductPicker, setShowProductPicker] = useState(false)

  const { data: products } = useQuery<any[]>({
    queryKey: ['notas_fiscais_avulsa_products', companyId, productSearch],
    enabled: !!companyId && showProductPicker,
    queryFn: async () => {
      let query = (supabase.from('products') as any)
        .select('id, name, unit, ncm, final_price')
        .eq('company_id', companyId!)
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(20)
      if (productSearch) query = query.ilike('name', `%${productSearch}%`)
      const { data } = await query
      return data ?? []
    },
  })

  function addItemFromProduct(p: any) {
    setItems(prev => [...prev, {
      tempId: uid(),
      code: p.id,
      name: p.name,
      unit: p.unit || 'UN',
      quantity: 1,
      unitPrice: Number(p.final_price) || 0,
      ncm: p.ncm || '',
    }])
    setShowProductPicker(false)
    setProductSearch('')
  }

  function addManualItem() {
    setItems(prev => [...prev, { tempId: uid(), code: '', name: '', unit: 'UN', quantity: 1, unitPrice: 0, ncm: '' }])
  }

  function updateItem(tempId: string, patch: Partial<AvulsaItem>) {
    setItems(prev => prev.map(i => i.tempId === tempId ? { ...i, ...patch } : i))
  }

  function removeItem(tempId: string) {
    setItems(prev => prev.filter(i => i.tempId !== tempId))
  }

  const total = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0)

  // ── Submissão ──
  const [missingFields, setMissingFields] = useState<MissingField[] | null>(null)

  const criarMutation = useMutation({
    mutationFn: async () => {
      setMissingFields(null)
      const res = await fetch('/api/notas-fiscais/avulsa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          naturezaOperacao,
          items: items.map(i => ({
            description: i.name, code: i.code || undefined, unit: i.unit,
            quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), ncm: i.ncm || null,
          })),
          extras: extrasParaPayload(extras),
        }),
      })
      const bodyJson = await res.json()
      if (!res.ok) {
        if (bodyJson?.missingFields) setMissingFields(bodyJson.missingFields)
        throw new Error(bodyJson?.error || 'Falha ao criar a nota avulsa no Bling')
      }
      return bodyJson.invoice
    },
    onSuccess: (invoice) => {
      toast('success', 'Nota avulsa criada como rascunho no Bling. Revise e confirme o envio.')
      router.push(`/notas-fiscais/avulsa/${invoice.id}`)
    },
    onError: (err: Error) => toast('error', err.message),
  })

  const canSubmit = !!customerId && items.length > 0 && items.every(i => i.name.trim() && i.quantity > 0 && i.unitPrice >= 0)

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl">
      <div>
        <button onClick={() => router.push('/notas-fiscais')} className="text-xs text-text-muted flex items-center gap-1 mb-2">
          <ArrowLeft size={13} /> Voltar
        </button>
        <Header title="Nova nota avulsa" subtitle="Emitir NF-e sem vincular a um pedido do Precy+" />
      </div>

      {missingFields && missingFields.length > 0 && (
        <div className="card p-4 border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-900/10">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Faltam dados para emitir</p>
              <ul className="mt-1.5 space-y-1 text-xs text-amber-700 dark:text-amber-400">
                {missingFields.map((m, idx) => (
                  <li key={idx}>
                    • {m.label}{m.productName ? ` — ${m.productName}` : ''}
                    {m.where === 'empresa' && ' (completar em Configurações → Empresa)'}
                    {m.where === 'cliente' && ' (completar no cadastro do destinatário acima)'}
                    {m.where === 'produto' && ' (completar o NCM do item abaixo)'}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* ── Operação ── */}
      <div className="card p-5 space-y-2">
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Operação</h3>
        <label className="text-xs text-text-muted mb-1 block">Natureza da operação</label>
        <input
          type="text"
          value={naturezaOperacao}
          onChange={e => setNaturezaOperacao(e.target.value)}
          className="input w-full sm:w-80"
        />
        <p className="text-[11px] text-text-muted mt-1">
          Precisa ser o nome exato de uma natureza de operação já cadastrada na sua conta Bling
          (Cadastros → Naturezas de Operação) — o Bling usa esse cadastro para definir o CFOP da nota.
        </p>
      </div>

      {/* ── Destinatário ── */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Destinatário</h3>

        <div className="grid grid-cols-2 gap-2 max-w-sm">
          <button
            type="button"
            onClick={() => setCustomerMode('existing')}
            className={clsx(
              'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors',
              customerMode === 'existing'
                ? 'bg-primary text-white border-primary'
                : 'bg-transparent text-text-muted border-border dark:border-border-dark hover:border-primary/40'
            )}
          >
            <UserCheck size={14} /> Cliente cadastrado
          </button>
          <button
            type="button"
            onClick={() => setCustomerMode('new')}
            className={clsx(
              'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors',
              customerMode === 'new'
                ? 'bg-primary text-white border-primary'
                : 'bg-transparent text-text-muted border-border dark:border-border-dark hover:border-primary/40'
            )}
          >
            <UserPlus size={14} /> Novo destinatário
          </button>
        </div>

        {customerMode === 'existing' ? (
          <div className="space-y-2.5">
            <div className="relative max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                className="input pl-9 w-full"
                placeholder="Buscar cliente cadastrado..."
                value={customerSearch}
                onFocus={() => setShowCustomerPicker(true)}
                onChange={e => { setCustomerSearch(e.target.value); setShowCustomerPicker(true); setCustomerId(null) }}
                autoComplete="off"
              />
              {showCustomerPicker && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl shadow-modal max-h-52 overflow-y-auto">
                  {(customers ?? []).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-primary-50 dark:hover:bg-primary/10 flex items-center justify-between gap-3 border-b border-border dark:border-border-dark last:border-0 transition-colors"
                      onClick={() => { setCustomerId(c.id); setCustomerSearch(c.name); setShowCustomerPicker(false) }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary dark:text-stone-100 leading-snug break-words">{c.name}</p>
                        {c.phone && <p className="text-[10px] text-text-muted dark:text-stone-500">{c.phone}</p>}
                      </div>
                    </button>
                  ))}
                  {(customers ?? []).length === 0 && (
                    <p className="text-xs text-text-muted dark:text-stone-500 text-center py-3">Nenhum cliente cadastrado</p>
                  )}
                </div>
              )}
            </div>

            {selectedCustomer && (
              <div className="rounded-xl border border-border dark:border-border-dark p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs max-w-md relative">
                <div><span className="text-text-muted">Nome: </span><b className="text-text-primary dark:text-stone-100">{selectedCustomer.name}</b></div>
                <div><span className="text-text-muted">CPF/CNPJ: </span><b className="text-text-primary dark:text-stone-100">{selectedCustomer.cpf_cnpj || '—'}</b></div>
                <div className="sm:col-span-2"><span className="text-text-muted">Endereço: </span><b className="text-text-primary dark:text-stone-100">{[selectedCustomer.street, selectedCustomer.city, selectedCustomer.state].filter(Boolean).join(' — ') || '—'}</b></div>
                <button
                  type="button"
                  onClick={() => setShowEditCustomerModal(true)}
                  className="sm:col-span-2 text-[11px] text-primary hover:underline flex items-center gap-1 mt-1"
                >
                  <Pencil size={10} /> completar/editar dados fiscais
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-border dark:border-border-dark p-3.5 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Nome *</label>
                <input type="text" className="input" placeholder="Nome completo ou razão social" value={newCustomer.name} onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Tipo</label>
                <select className="input" value={newCustomer.person_type} onChange={e => setNewCustomer(p => ({ ...p, person_type: e.target.value as 'fisica' | 'juridica' }))}>
                  <option value="fisica">Pessoa física</option>
                  <option value="juridica">Pessoa jurídica</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">CPF/CNPJ</label>
                <input type="text" className="input" value={newCustomer.cpf_cnpj} onChange={e => setNewCustomer(p => ({ ...p, cpf_cnpj: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Telefone</label>
                <input type="text" className="input" value={newCustomer.phone} onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">E-mail</label>
                <input type="email" className="input" value={newCustomer.email} onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="sm:col-span-2 grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Rua</label>
                  <input type="text" className="input" value={newCustomer.street} onChange={e => setNewCustomer(p => ({ ...p, street: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Número</label>
                  <input type="text" className="input" value={newCustomer.number} onChange={e => setNewCustomer(p => ({ ...p, number: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Bairro</label>
                <input type="text" className="input" value={newCustomer.neighborhood} onChange={e => setNewCustomer(p => ({ ...p, neighborhood: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Cidade</label>
                  <input type="text" className="input" value={newCustomer.city} onChange={e => setNewCustomer(p => ({ ...p, city: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">UF</label>
                  <input type="text" maxLength={2} className="input uppercase" value={newCustomer.state} onChange={e => setNewCustomer(p => ({ ...p, state: e.target.value.toUpperCase() }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">CEP</label>
                <input type="text" className="input" value={newCustomer.zip_code} onChange={e => setNewCustomer(p => ({ ...p, zip_code: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setCustomerMode('existing')} className="btn-secondary flex-1">Cancelar</button>
              <button
                type="button"
                disabled={!newCustomer.name.trim() || createCustomerMutation.isPending}
                onClick={() => createCustomerMutation.mutate()}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {createCustomerMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                {createCustomerMutation.isPending ? 'Salvando...' : 'Salvar destinatário'}
              </button>
            </div>
          </div>
        )}
      </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
      {/* ── Produtos/Serviços ── */}
      <div className="card p-5 space-y-3 lg:col-span-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Produtos/serviços</h3>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowProductPicker(v => !v)} className="btn-secondary text-xs flex items-center gap-1.5">
              <Package size={13} /> Adicionar do catálogo
            </button>
            <button type="button" onClick={addManualItem} className="btn-secondary text-xs flex items-center gap-1.5">
              <Plus size={13} /> Item avulso
            </button>
          </div>
        </div>

        {showProductPicker && (
          <div className="rounded-xl border border-border dark:border-border-dark p-3 space-y-2 max-w-md">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                className="input pl-9 w-full"
                placeholder="Buscar produto..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-52 overflow-y-auto divide-y divide-border dark:divide-border-dark">
              {(products ?? []).map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addItemFromProduct(p)}
                  className="w-full text-left px-2 py-2 hover:bg-primary-50 dark:hover:bg-white/5 flex items-center justify-between gap-2 text-sm"
                >
                  <span className="text-text-secondary dark:text-stone-300">{p.name}</span>
                  <span className="text-text-muted text-xs">{formatCurrency(p.final_price)}</span>
                </button>
              ))}
              {(products ?? []).length === 0 && (
                <p className="text-xs text-text-muted text-center py-3">Nenhum produto encontrado.</p>
              )}
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-xs text-text-muted py-4 text-center">Nenhum item adicionado ainda.</p>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.tempId} className="rounded-xl border border-border dark:border-border-dark p-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">Descrição</label>
                  <input type="text" className="input w-full" placeholder="Nome do item" value={item.name} onChange={e => updateItem(item.tempId, { name: e.target.value })} />
                </div>
                <div className="w-20">
                  <label className="text-[11px] text-text-muted block mb-1">Qtd.</label>
                  <input type="number" min={0} step="1" className="input w-full" value={item.quantity} onChange={e => updateItem(item.tempId, { quantity: Number(e.target.value) })} />
                </div>
                <div className="w-28">
                  <label className="text-[11px] text-text-muted block mb-1">Valor unit.</label>
                  <input type="number" min={0} step="0.01" className="input w-full" value={item.unitPrice} onChange={e => updateItem(item.tempId, { unitPrice: Number(e.target.value) })} />
                </div>
                <div className="w-24">
                  <label className="text-[11px] text-text-muted block mb-1">NCM</label>
                  <input type="text" className="input w-full" value={item.ncm} onChange={e => updateItem(item.tempId, { ncm: e.target.value })} />
                </div>
                <button type="button" onClick={() => removeItem(item.tempId)} className="p-2 rounded-lg text-text-muted hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-error">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Resumo/Revisão ── */}
      <div className="card p-5 space-y-3 lg:col-span-1 lg:sticky lg:top-20">
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Resumo</h3>
        <div className="text-sm text-text-secondary dark:text-stone-300 space-y-1">
          <p>Destinatário: <span className="font-medium">{selectedCustomer?.name ?? '—'}</span></p>
          <p>Itens: <span className="font-medium">{items.length}</span></p>
          <p>Total: <span className="font-semibold text-text-primary dark:text-stone-100">{formatCurrency(total)}</span></p>
        </div>
        <p className="text-xs text-text-muted">
          Isso cria um <strong>rascunho</strong> no Bling — a nota só é enviada à SEFAZ depois, com uma confirmação separada.
        </p>
        <button
          type="button"
          onClick={() => criarMutation.mutate()}
          disabled={!canSubmit || criarMutation.isPending}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {criarMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
          Criar rascunho da nota no Bling
        </button>
      </div>
      </div>

      <NotaFiscalExtrasForm value={extras} onChange={setExtras} />

      {showEditCustomerModal && selectedCustomer && (
        <CompletarDestinatarioModal
          customer={selectedCustomer}
          onClose={() => setShowEditCustomerModal(false)}
          onSaved={() => {
            setShowEditCustomerModal(false)
            queryClient.invalidateQueries({ queryKey: ['notas_fiscais_avulsa_customers', companyId] })
          }}
        />
      )}
    </div>
  )
}
