'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { formatCep, formatCpfCnpj, onlyDigits } from '@/lib/utils/mask'
import { useCepLookup } from '@/hooks/useCepLookup'
import { formatCurrency } from '@/lib/utils/format'
import {
  buildDeclarationDocumentHTML, printContentDeclaration,
  type DeclarationDocumentData, type DeclarationPartyDoc,
} from '@/lib/pdf/contentDeclarationDocument'
import {
  Search, Plus, Trash2, Loader2, Printer, Save, Scale, X,
} from 'lucide-react'

/* ─── Tipos ─── */
export interface PartyState {
  name: string; document: string; zipCode: string; street: string; number: string
  complement: string; neighborhood: string; city: string; state: string
}
export interface ItemState {
  localId: string; productId: string | null; description: string; quantity: string
  value: string; weightHint: number | null
}
export interface DeclarationInitial {
  customerId:      string | null
  orderId:         string | null
  sender:          PartyState
  recipient:       PartyState
  items:           ItemState[]
  totalWeightKg:   string
  declarationCity: string
  declarationDate: string
  notes:           string
}

export function emptyParty(): PartyState {
  return { name: '', document: '', zipCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
}
export function newItemRow(): ItemState {
  return { localId: crypto.randomUUID(), productId: null, description: '', quantity: '1', value: '', weightHint: null }
}
export function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function toPartyDoc(p: PartyState): DeclarationPartyDoc {
  return {
    name: p.name, document: p.document || null, zipCode: p.zipCode || null,
    street: p.street || null, number: p.number || null, complement: p.complement || null,
    neighborhood: p.neighborhood || null, city: p.city || null, state: p.state || null,
  }
}

const A4_W = 793.7 // ~210mm @ 96dpi
const A4_H = 1122.5 // ~297mm @ 96dpi

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

interface Props {
  companyId:      string
  declarationId?: string
  initial:        DeclarationInitial
}

export function DeclarationEditor({ companyId, declarationId, initial }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  const [sender, setSender]       = useState<PartyState>(initial.sender)
  const [recipient, setRecipient] = useState<PartyState>(initial.recipient)
  const [customerId, setCustomerId] = useState<string | null>(initial.customerId)
  const [items, setItems]         = useState<ItemState[]>(initial.items)
  const [weight, setWeight]       = useState(initial.totalWeightKg)
  const [declCity, setDeclCity]   = useState(initial.declarationCity)
  const [declDate, setDeclDate]   = useState(initial.declarationDate)
  const [notes, setNotes]         = useState(initial.notes)
  const [saving, setSaving]       = useState(false)

  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [showProductPicker, setShowProductPicker] = useState(false)

  /* ── Clientes (destinatário) ── */
  const { data: customers } = useQuery({
    queryKey: ['customers-picker-decl', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('customers') as any)
        .select('id, name, cpf_cnpj, zip_code, street, number, complement, neighborhood, city, state, address')
        .eq('company_id', companyId).order('name')
      return (data ?? []) as any[]
    },
  })

  /* ── Produtos (itens) ── */
  const { data: products } = useQuery({
    queryKey: ['products-picker-decl', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('products') as any)
        .select('id, name, final_price, weight_kg, category')
        .eq('company_id', companyId).eq('is_active', true).order('name')
      return (data ?? []) as any[]
    },
  })

  function selectCustomer(c: any) {
    setCustomerId(c.id)
    setRecipient({
      name: c.name ?? '',
      document: c.cpf_cnpj ?? '',
      zipCode: c.zip_code ?? '',
      street: c.street ?? '',
      number: c.number ?? '',
      complement: c.complement ?? '',
      neighborhood: c.neighborhood ?? '',
      city: c.city ?? '',
      state: c.state ?? '',
    })
    setCustomerSearch(c.name)
    setShowCustomerPicker(false)
  }

  function clearCustomer() {
    setCustomerId(null)
    setCustomerSearch('')
    setRecipient(emptyParty())
  }

  /* ── CEP do destinatário — não sobrescreve número/complemento ── */
  const cepLookup = useCepLookup({
    onFound: data => {
      setRecipient(r => ({
        ...r,
        street: data.logradouro || r.street,
        neighborhood: data.bairro || r.neighborhood,
        city: data.cidade || r.city,
        state: data.uf || r.state,
      }))
      toast('success', 'Endereço encontrado.')
    },
  })

  /* ── Itens ── */
  function addItemFromProduct(p: any) {
    setItems(prev => [...prev, {
      localId: crypto.randomUUID(),
      productId: p.id,
      description: p.name,
      quantity: '1',
      value: String(Number(p.final_price) || 0),
      weightHint: p.weight_kg != null ? Number(p.weight_kg) : null,
    }])
    setProductSearch('')
    setShowProductPicker(false)
  }
  function addManualItem() {
    setItems(prev => [...prev, newItemRow()])
  }
  function updateItem(localId: string, patch: Partial<ItemState>) {
    setItems(prev => prev.map(i => (i.localId === localId ? { ...i, ...patch } : i)))
  }
  function removeItem(localId: string) {
    setItems(prev => prev.filter(i => i.localId !== localId))
  }

  function calcWeight() {
    const known = items.filter(i => i.weightHint != null)
    if (known.length === 0) {
      toast('warning', 'Nenhum item selecionado tem peso cadastrado no produto — informe manualmente.')
      return
    }
    const total = known.reduce((s, i) => s + i.weightHint! * (Number(i.quantity) || 0), 0)
    setWeight(total.toFixed(3))
  }

  /* ── Totais ── */
  const totalQuantity = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
  const totalValue = items.reduce((s, i) => s + (Number(i.value) || 0), 0)

  function buildDocData(): DeclarationDocumentData {
    return {
      sender: toPartyDoc(sender),
      recipient: toPartyDoc(recipient),
      items: items.map(i => ({ description: i.description, quantity: Number(i.quantity) || 0, value: Number(i.value) || 0 })),
      totalQuantity,
      totalValue,
      totalWeightKg: weight ? Number(String(weight).replace(',', '.')) || null : null,
      declarationCity: declCity,
      declarationDate: declDate,
      notes: notes || null,
    }
  }

  /* ── Preview ao vivo, escalado para caber na coluna ── */
  const previewWrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = previewWrapRef.current
    if (!el) return
    function update() { setScale(el!.clientWidth / A4_W) }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const previewHtml = buildDeclarationDocumentHTML(buildDocData())

  /* ── Validação + Salvar ── */
  function validate(): string | null {
    if (!sender.name.trim()) return 'O remetente precisa de um nome (verifique os dados da empresa em Configurações).'
    if (!recipient.name.trim()) return 'Informe o destinatário.'
    if (items.length === 0) return 'Adicione ao menos um item.'
    for (const i of items) {
      if (!i.description.trim()) return 'Todos os itens precisam de uma descrição.'
      if (!(Number(i.quantity) > 0)) return 'A quantidade de cada item deve ser maior que zero.'
      if (i.value === '' || Number(i.value) < 0) return 'Informe um valor válido (maior ou igual a zero) para cada item.'
    }
    if (!declCity.trim()) return 'Informe a cidade da declaração.'
    if (!declDate) return 'Informe a data da declaração.'
    return null
  }

  async function handleSave() {
    const err = validate()
    if (err) { toast('error', err); return }

    setSaving(true)
    try {
      const payload = {
        company_id: companyId,
        customer_id: customerId,
        order_id: initial.orderId,
        sender_name: sender.name, sender_document: sender.document || null, sender_zip_code: onlyDigits(sender.zipCode) || null,
        sender_street: sender.street || null, sender_number: sender.number || null, sender_complement: sender.complement || null,
        sender_neighborhood: sender.neighborhood || null, sender_city: sender.city || null, sender_state: sender.state || null,
        recipient_name: recipient.name, recipient_document: recipient.document || null, recipient_zip_code: onlyDigits(recipient.zipCode) || null,
        recipient_street: recipient.street || null, recipient_number: recipient.number || null, recipient_complement: recipient.complement || null,
        recipient_neighborhood: recipient.neighborhood || null, recipient_city: recipient.city || null, recipient_state: recipient.state || null,
        declaration_city: declCity,
        declaration_date: declDate,
        total_quantity: totalQuantity,
        total_value: totalValue,
        total_weight_kg: weight ? Number(String(weight).replace(',', '.')) || null : null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      }

      let id = declarationId
      if (id) {
        const { error } = await (supabase.from('content_declarations') as any).update(payload).eq('id', id)
        if (error) throw error
        await (supabase.from('content_declaration_items') as any).delete().eq('declaration_id', id)
      } else {
        const { data, error } = await (supabase.from('content_declarations') as any).insert([payload]).select('id').single()
        if (error) throw error
        id = data!.id as string
      }

      const itemRows = items.map((i, idx) => ({
        declaration_id: id,
        product_id: i.productId,
        description: i.description.trim(),
        quantity: Number(i.quantity) || 0,
        value: Number(i.value) || 0,
        sort_order: idx,
      }))
      const { error: itemsErr } = await (supabase.from('content_declaration_items') as any).insert(itemRows)
      if (itemsErr) throw itemsErr

      toast('success', declarationId ? 'Declaração atualizada!' : 'Declaração criada!')
      if (!declarationId) router.replace(`/declaracao-conteudo/${id}`)
      else router.refresh()
    } catch (e: any) {
      toast('error', `Erro ao salvar: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  function handlePrint() {
    const err = validate()
    if (err) { toast('error', err); return }
    printContentDeclaration(buildDocData())
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-5 items-start">
      {/* ═══ FORMULÁRIO ═══ */}
      <div className="space-y-4 order-1">

        {/* Remetente */}
        <div className="card">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">Remetente</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Field label="Nome / Razão Social">
                <input className="input" value={sender.name} onChange={e => setSender(s => ({ ...s, name: e.target.value }))} />
              </Field>
            </div>
            <Field label="CNPJ/CPF">
              <input className="input" value={sender.document} onChange={e => setSender(s => ({ ...s, document: formatCpfCnpj(e.target.value) }))} />
            </Field>
            <Field label="CEP">
              <input className="input" value={sender.zipCode} onChange={e => setSender(s => ({ ...s, zipCode: formatCep(e.target.value) }))} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Endereço">
                <input className="input" value={sender.street} onChange={e => setSender(s => ({ ...s, street: e.target.value }))} />
              </Field>
            </div>
            <Field label="Cidade">
              <input className="input" value={sender.city} onChange={e => setSender(s => ({ ...s, city: e.target.value }))} />
            </Field>
            <Field label="UF">
              <input className="input uppercase" maxLength={2} value={sender.state} onChange={e => setSender(s => ({ ...s, state: e.target.value }))} />
            </Field>
          </div>
          <p className="text-[11px] text-text-muted dark:text-stone-500 mt-2">
            Preenchido a partir dos dados da empresa (Configurações → Endereço). Pode ser editado só nesta declaração.
          </p>
        </div>

        {/* Destinatário */}
        <div className="card">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">Destinatário</p>

          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                className="input pl-9"
                placeholder="Buscar cliente cadastrado..."
                value={customerSearch}
                onFocus={() => setShowCustomerPicker(true)}
                onChange={e => { setCustomerSearch(e.target.value); setShowCustomerPicker(true) }}
                autoComplete="off"
              />
              {showCustomerPicker && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl shadow-modal max-h-52 overflow-y-auto">
                  {(customers ?? [])
                    .filter((c: any) => customerSearch === '' || c.name.toLowerCase().includes(customerSearch.toLowerCase()))
                    .slice(0, 8)
                    .map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-primary-50 dark:hover:bg-primary/10 flex items-center justify-between gap-3 border-b border-border dark:border-border-dark last:border-0 transition-colors"
                        onClick={() => selectCustomer(c)}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary dark:text-stone-100 leading-snug break-words">{c.name}</p>
                          {c.cpf_cnpj && <p className="text-[10px] text-text-muted dark:text-stone-500">{c.cpf_cnpj}</p>}
                        </div>
                      </button>
                    ))}
                  {(customers ?? []).length === 0 && (
                    <p className="text-xs text-text-muted dark:text-stone-500 text-center py-3">Nenhum cliente cadastrado</p>
                  )}
                </div>
              )}
            </div>
            {customerId && (
              <button type="button" onClick={clearCustomer} className="btn-secondary px-3 flex-shrink-0" title="Preencher manualmente">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Field label="Nome / Razão Social *">
                <input className="input" value={recipient.name} onChange={e => setRecipient(r => ({ ...r, name: e.target.value }))} />
              </Field>
            </div>
            <Field label="CPF/CNPJ">
              <input className="input" value={recipient.document} onChange={e => setRecipient(r => ({ ...r, document: formatCpfCnpj(e.target.value) }))} />
            </Field>
            <Field label="CEP">
              <div className="relative">
                <input
                  className="input pr-8"
                  value={recipient.zipCode}
                  onChange={e => {
                    const formatted = formatCep(e.target.value)
                    setRecipient(r => ({ ...r, zipCode: formatted }))
                    cepLookup.searchOnComplete(formatted)
                  }}
                />
                {cepLookup.loading && <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />}
              </div>
            </Field>
            <Field label="Endereço">
              <input className="input" value={recipient.street} onChange={e => setRecipient(r => ({ ...r, street: e.target.value }))} />
            </Field>
            <Field label="Número">
              <input className="input" value={recipient.number} onChange={e => setRecipient(r => ({ ...r, number: e.target.value }))} />
            </Field>
            <Field label="Complemento">
              <input className="input" value={recipient.complement} onChange={e => setRecipient(r => ({ ...r, complement: e.target.value }))} />
            </Field>
            <Field label="Bairro">
              <input className="input" value={recipient.neighborhood} onChange={e => setRecipient(r => ({ ...r, neighborhood: e.target.value }))} />
            </Field>
            <Field label="Cidade">
              <input className="input" value={recipient.city} onChange={e => setRecipient(r => ({ ...r, city: e.target.value }))} />
            </Field>
            <Field label="UF">
              <input className="input uppercase" maxLength={2} value={recipient.state} onChange={e => setRecipient(r => ({ ...r, state: e.target.value }))} />
            </Field>
          </div>
        </div>

        {/* Identificação dos bens */}
        <div className="card">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">Identificação dos bens</p>

          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Selecionar produto cadastrado..."
              value={productSearch}
              onFocus={() => setShowProductPicker(true)}
              onChange={e => { setProductSearch(e.target.value); setShowProductPicker(true) }}
              autoComplete="off"
            />
            {showProductPicker && (
              <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl shadow-modal max-h-52 overflow-y-auto">
                {(products ?? [])
                  .filter((p: any) => productSearch === '' || p.name.toLowerCase().includes(productSearch.toLowerCase()))
                  .slice(0, 8)
                  .map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-primary-50 dark:hover:bg-primary/10 flex items-center justify-between gap-3 border-b border-border dark:border-border-dark last:border-0 transition-colors"
                      onClick={() => addItemFromProduct(p)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary dark:text-stone-100 leading-snug break-words">{p.name}</p>
                        {p.category && <p className="text-[10px] text-text-muted dark:text-stone-500">{p.category}</p>}
                      </div>
                      <span className="text-sm font-bold text-primary flex-shrink-0">{formatCurrency(Number(p.final_price))}</span>
                    </button>
                  ))}
                {(products ?? []).length === 0 && (
                  <p className="text-xs text-text-muted dark:text-stone-500 text-center py-3">Nenhum produto cadastrado</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {items.length === 0 && (
              <p className="text-xs text-text-muted dark:text-stone-500 text-center py-4 border border-dashed border-border dark:border-border-dark rounded-xl">
                Nenhum item adicionado ainda.
              </p>
            )}
            {items.map((item, idx) => (
              <div key={item.localId} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center border border-border dark:border-border-dark rounded-xl p-2.5">
                <span className="text-xs font-bold text-text-muted w-5 flex-shrink-0 text-center">{idx + 1}</span>
                <input
                  className="input flex-1"
                  placeholder="Descrição/Conteúdo"
                  value={item.description}
                  onChange={e => updateItem(item.localId, { description: e.target.value })}
                />
                <input
                  className="input w-full sm:w-24"
                  type="number" min="0" step="1"
                  placeholder="Qtd"
                  value={item.quantity}
                  onChange={e => updateItem(item.localId, { quantity: e.target.value })}
                />
                <input
                  className="input w-full sm:w-32"
                  type="number" min="0" step="0.01"
                  placeholder="Valor total"
                  value={item.value}
                  onChange={e => updateItem(item.localId, { value: e.target.value })}
                />
                <button type="button" onClick={() => removeItem(item.localId)} className="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button type="button" onClick={addManualItem} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
            <Plus size={14} /> Adicionar item
          </button>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border dark:border-border-dark text-sm">
            <span className="font-bold text-text-primary dark:text-stone-100">TOTAL</span>
            <span className="text-text-secondary dark:text-stone-400">{totalQuantity} {totalQuantity === 1 ? 'item' : 'itens'}</span>
            <span className="font-bold text-primary">{formatCurrency(totalValue)}</span>
          </div>
        </div>

        {/* Peso + Data */}
        <div className="card grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">Peso total (kg)</p>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                type="text" inputMode="decimal"
                placeholder="0,000"
                value={weight}
                onChange={e => setWeight(e.target.value)}
              />
              <button type="button" onClick={calcWeight} className="btn-secondary px-3 flex-shrink-0" title="Calcular a partir dos produtos">
                <Scale size={14} />
              </button>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">Data da declaração</p>
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Cidade" value={declCity} onChange={e => setDeclCity(e.target.value)} />
              <input className="input" type="date" value={declDate} onChange={e => setDeclDate(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Observação */}
        <div className="card">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">Observação (opcional)</p>
          <textarea rows={2} className="input resize-none" placeholder="Alguma observação adicional para este envio..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

      </div>

      {/* ═══ PREVIEW ═══ — coluna direita fixa no desktop, abaixo do formulário no mobile */}
      <div className="order-2 lg:sticky lg:top-20 space-y-3">
        <div className="flex gap-2">
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Salvando...' : 'Salvar declaração'}
          </button>
          <button type="button" onClick={handlePrint} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <Printer size={15} /> Imprimir / PDF
          </button>
        </div>
        <div ref={previewWrapRef} className="w-full overflow-hidden rounded-xl border border-border dark:border-border-dark bg-stone-300 dark:bg-stone-800 shadow-inner" style={{ height: scale * A4_H }}>
          <iframe
            title="Prévia da declaração"
            srcDoc={previewHtml}
            style={{ width: A4_W, height: A4_H, border: 'none', transform: `scale(${scale})`, transformOrigin: 'top left' }}
          />
        </div>
      </div>
    </div>
  )
}
