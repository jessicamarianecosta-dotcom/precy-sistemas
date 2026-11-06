'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/lib/catalog/useCart'
import { useToast } from '@/components/ui/Toaster'
import { formatCurrency } from '@/lib/utils/format'
import { ArrowLeft, Minus, Plus, Trash2, Loader2, Upload, MessageCircle, Pencil } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { StoreThemeRoot } from '@/components/catalog/storefront/StoreThemeRoot'
import { StoreHeader } from '@/components/catalog/storefront/StoreHeader'
import { useProductFavorites } from '@/lib/catalog/useProductFavorites'
import { resolvePalettes } from '@/lib/catalog/theme/palette'
import { OBSERVATION_MAX, cleanObservation } from '@/lib/catalog/observation'
import { useCheckoutState, CHECKOUT_STEPS, type CheckoutStep } from '@/lib/catalog/checkout/useCheckoutState'
import { StepIndicator } from '@/components/catalog/checkout/StepIndicator'
import { StepCadastro } from '@/components/catalog/checkout/steps/StepCadastro'

/**
 * Checkout da loja — reformulado em 4 etapas (Cadastro / Produto e arte /
 * Entrega / Pagamento). A Etapa 1 já é um passo isolado e real
 * (StepCadastro). As etapas 2 a 4 ainda estão consolidadas numa única tela
 * (mesmos campos e integrações de antes — carrinho, upload de arte, frete
 * via SuperFrete, Mercado Pago/WhatsApp) enquanto são divididas em etapas
 * próprias nas próximas fases desta reformulação; nada aqui é mock.
 */
export default function CheckoutLojaPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const { items, updateQty, updateNotes, removeItem, total, clear } = useCart(slug)
  const [editingNotesKey, setEditingNotesKey] = useState<string | null>(null)
  const checkout = useCheckoutState(slug)

  const { data: storeSettings } = useQuery<{ whatsapp: string | null; logo_url: string | null; theme_color: string; theme_palette: import('@/lib/catalog/theme/palette').StoreThemePalettes | null; companies: { name: string } | null } | null>({
    queryKey: ['loja-checkout-settings', slug],
    queryFn: async () => {
      const { data, error } = await (supabase.from('catalog_settings') as any)
        .select('whatsapp, logo_url, theme_color, theme_palette, companies(name)').eq('slug', slug).maybeSingle()
      if (error) throw error
      return data ?? null
    },
  })
  const storeWhatsapp = storeSettings?.whatsapp ?? null
  const storeName = storeSettings?.companies?.name ?? slug
  const palettes = resolvePalettes(storeSettings ?? { theme_color: '#8B6C4F', theme_palette: null })
  const { favoriteIds } = useProductFavorites(slug)
  const cartCount = items.reduce((s, i) => s + i.quantity, 0)

  // Sem conexão Mercado Pago ativa da empresa, "Finalizar pelo site" não tem
  // como cobrar nada — nem mostramos o botão, igual já acontece hoje para
  // produtos em modo "quote" (ver app/loja/[slug]/produto/[productId]/page.tsx).
  const { data: onlinePaymentAvailable, isLoading: loadingOnlinePayment } = useQuery<boolean>({
    queryKey: ['loja-checkout-pagamento-online', slug],
    queryFn: async () => {
      const res = await fetch(`/api/loja/pagamento-online?slug=${encodeURIComponent(slug)}`)
      if (!res.ok) return false
      const data = await res.json()
      return !!data.available
    },
  })

  const customer = checkout.customer
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [shippingOptions, setShippingOptions] = useState<{ service: string; price: number; days: number }[]>([])
  const [calculatingShipping, setCalculatingShipping] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submittingVia, setSubmittingVia] = useState<'online' | 'whatsapp' | null>(null)
  const shipping = checkout.shipping

  // Etapas já concluídas: tudo antes da etapa atual. Permite clicar para
  // voltar e editar sem perder os dados preenchidos.
  const completedSteps: CheckoutStep[] = CHECKOUT_STEPS.slice(0, checkout.stepIndex)

  async function calcShipping() {
    const cep = customer.cep.replace(/\D/g, '')
    if (cep.length !== 8) { toast('error', 'Informe um CEP válido'); return }
    setCalculatingShipping(true)
    try {
      // Peso/dimensões reais do pedido são buscados no servidor a partir do
      // cadastro de cada produto — o client só informa produto e quantidade.
      const res = await fetch('/api/loja/frete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, cep,
          items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao calcular frete')
      setShippingOptions(data.quotes ?? [])
      checkout.setShipping(data.quotes?.[0] ?? null)
    } catch (err: any) {
      toast('error', err.message)
    } finally {
      setCalculatingShipping(false)
    }
  }

  function buildWhatsappMessage(orderNumber: string) {
    const shippingPrice = shipping?.price ?? 0
    const lines = [
      `Olá! Quero finalizar meu pedido na loja ${slug}.`,
      `Pedido: ${orderNumber}`,
      '',
      'Produtos:',
      ...items.map(i => `- ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ''} — ${i.quantity}x — ${formatCurrency(i.price)}`),
      '',
      `Subtotal: ${formatCurrency(total)}`,
    ]
    if (shipping) lines.push(`Frete: ${formatCurrency(shippingPrice)} (${shipping.service})`)
    lines.push(`Total: ${formatCurrency(total + shippingPrice)}`)
    if (customer.cep) lines.push(`Meu CEP: ${customer.cep}`)
    lines.push('', 'Podem me orientar sobre a finalização do pagamento?')
    return lines.join('\n')
  }

  async function submitOrder(fulfillment: 'online' | 'whatsapp') {
    if (items.length === 0) { toast('error', 'Seu carrinho está vazio'); return }
    if (!customer.name || !customer.phone) { toast('error', 'Nome e telefone são obrigatórios'); return }
    if (fulfillment === 'online' && !onlinePaymentAvailable) {
      toast('error', 'Pagamento pelo site indisponível nesta loja — finalize pelo WhatsApp.')
      return
    }
    if (fulfillment === 'online' && !customer.email) { toast('error', 'Informe seu e-mail para receber a confirmação do pagamento'); return }
    if (fulfillment === 'whatsapp' && !storeWhatsapp) { toast('error', 'Esta loja não configurou um WhatsApp para atendimento.'); return }
    if (fulfillment === 'online' && !shipping) { toast('error', 'Calcule e escolha o frete antes de finalizar'); return }

    setSubmitting(true)
    setSubmittingVia(fulfillment)
    try {
      let artwork: { url: string; path: string; fileName: string; fileSize: number; mimeType: string | null } | null = null
      if (artworkFile) {
        const body = new FormData()
        body.append('file', artworkFile)
        body.append('slug', slug)
        const res = await fetch('/api/loja/upload-arte', { method: 'POST', body })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar arte')
        artwork = { url: data.url, path: data.path, fileName: data.fileName, fileSize: data.fileSize, mimeType: data.mimeType }
      }

      const res = await fetch('/api/loja/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          items: items.map(i => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity, notes: i.notes ?? null })),
          customer,
          // O preço do frete NUNCA é enviado — o servidor recota a mesma
          // modalidade escolhida (shippingService) a partir do CEP e dos
          // produtos reais antes de cobrar (ver /api/loja/checkout).
          shippingService: shipping?.service ?? null,
          shippingCep: customer.cep ? customer.cep.replace(/\D/g, '') : null,
          artwork,
          fulfillment,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          data?.error ??
          (fulfillment === 'online'
            ? 'Não foi possível iniciar o pagamento. Tente novamente ou finalize pelo WhatsApp.'
            : 'Erro ao finalizar pedido')
        )
      }
      if (!data) throw new Error('Resposta inesperada do servidor. Tente novamente.')

      if (fulfillment === 'whatsapp') {
        // Abrir o WhatsApp não significa que a mensagem foi enviada nem que o
        // pedido foi pago — ele continua "pending" até o lojista confirmar
        // manualmente no painel. Só o carrinho é limpo aqui.
        const message = buildWhatsappMessage(data.orderNumber)
        window.open(`https://wa.me/${storeWhatsapp!.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank', 'noreferrer')
        clear()
        checkout.reset()
        toast('success', `Pedido ${data.orderNumber} criado! Continue pelo WhatsApp.`)
        router.push(`/loja/${slug}`)
        return
      }

      clear()
      checkout.reset()
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl
      } else {
        toast('success', `Pedido ${data.orderNumber} criado!`)
        router.push(`/loja/${slug}/pedido/${data.checkoutRef}`)
      }
    } catch (err: any) {
      toast('error', err.message)
    } finally {
      setSubmitting(false)
      setSubmittingVia(null)
    }
  }

  return (
    <StoreThemeRoot palettes={palettes}>
    <div className="min-h-screen bg-[var(--store-bg)] text-[var(--store-text)]">
      <StoreHeader slug={slug} storeName={storeName} logoUrl={storeSettings?.logo_url} cartCount={cartCount} favoriteCount={favoriteIds.length} />
      <div className="max-w-2xl mx-auto px-4 py-6">
        {checkout.step === 'cadastro' ? (
          <Link href={`/loja/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-[var(--store-primary)] mb-4">
            <ArrowLeft size={15} /> Continuar comprando
          </Link>
        ) : (
          <button type="button" onClick={checkout.goBack} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-[var(--store-primary)] mb-4">
            <ArrowLeft size={15} /> Voltar
          </button>
        )}

        <h1 className="text-lg font-bold mb-4" style={{ color: 'var(--store-text)' }}>Finalizar pedido</h1>

        {items.length === 0 ? (
          <p className="text-sm text-text-muted">Seu carrinho está vazio.</p>
        ) : (
          <>
            <StepIndicator currentStep={checkout.step} completedSteps={completedSteps} onStepClick={checkout.setStep} />

            {checkout.step === 'cadastro' && (
              <StepCadastro
                slug={slug}
                customer={customer}
                onChange={checkout.patchCustomer}
                onNext={checkout.goNext}
              />
            )}

            {checkout.step !== 'cadastro' && (
          <div className="space-y-5">
            <div className="card divide-y divide-border dark:divide-border-dark">
              {items.map(item => {
                const itemKey = `${item.productId}:${item.variantId ?? ''}`
                const isEditingNotes = editingNotesKey === itemKey
                return (
                <div key={itemKey} className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-lg bg-surface dark:bg-white/5 overflow-hidden flex-shrink-0">
                      {item.photo && <Image src={item.photo} alt="" fill sizes="48px" className="object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">{item.name}</p>
                      {item.variantLabel && <p className="text-[11px] text-text-muted truncate">{item.variantLabel}</p>}
                      {!isEditingNotes && item.notes && <p className="text-[11px] text-text-muted line-clamp-2">Obs.: {item.notes}</p>}
                      <p className="text-xs text-text-muted">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => updateQty(item.productId, item.variantId, item.quantity - 1)} className="p-1 rounded hover:bg-[var(--store-surface)] dark:hover:bg-white/5"><Minus size={13} /></button>
                      <span className="text-sm w-5 text-center">{item.quantity}</span>
                      <button type="button" onClick={() => updateQty(item.productId, item.variantId, item.quantity + 1)} className="p-1 rounded hover:bg-[var(--store-surface)] dark:hover:bg-white/5"><Plus size={13} /></button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingNotesKey(isEditingNotes ? null : itemKey)}
                      title="Editar observação"
                      className="p-1.5 text-text-muted hover:text-[var(--store-primary)]"
                    >
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => removeItem(item.productId, item.variantId)} className="p-1.5 text-text-muted hover:text-error"><Trash2 size={14} /></button>
                  </div>
                  {isEditingNotes && (
                    <div className="pl-[60px]">
                      <textarea
                        autoFocus
                        className="input text-xs"
                        rows={2}
                        maxLength={OBSERVATION_MAX}
                        placeholder="Observação sobre este produto..."
                        defaultValue={item.notes ?? ''}
                        onBlur={e => { updateNotes(item.productId, item.variantId, cleanObservation(e.target.value)); setEditingNotesKey(null) }}
                      />
                    </div>
                  )}
                </div>
                )
              })}
            </div>

            <form onSubmit={e => { e.preventDefault(); submitOrder('online') }} className="space-y-4">
              <div className="card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Entrega e arte</h3>
                <div className="flex gap-2">
                  <input
                    className="input flex-1" placeholder="CEP" value={customer.cep}
                    onChange={e => checkout.patchCustomer({ cep: e.target.value })}
                  />
                  <button type="button" onClick={calcShipping} disabled={calculatingShipping} className="btn-secondary whitespace-nowrap">
                    {calculatingShipping ? <Loader2 size={15} className="animate-spin" /> : 'Calcular frete'}
                  </button>
                </div>
                {shippingOptions.length > 0 && (
                  <div className="space-y-1.5">
                    {shippingOptions.map(opt => (
                      <label key={opt.service} className="flex items-center justify-between text-sm p-2 rounded-lg border border-border dark:border-border-dark cursor-pointer">
                        <span className="flex items-center gap-2">
                          <input type="radio" name="shipping" checked={shipping?.service === opt.service} onChange={() => checkout.setShipping(opt)} />
                          {opt.service} · {opt.days} dia(s)
                        </span>
                        <span className="font-semibold">{formatCurrency(opt.price)}</span>
                      </label>
                    ))}
                  </div>
                )}
                <textarea className="input" rows={2} placeholder="Observações (opcional)" value={customer.notes} onChange={e => checkout.patchCustomer({ notes: e.target.value })} />
                <div>
                  <label className="flex items-center gap-2 text-sm text-text-secondary dark:text-stone-400 cursor-pointer">
                    <Upload size={15} />
                    {artworkFile ? artworkFile.name : 'Enviar arte (opcional)'}
                    <input type="file" className="hidden" onChange={e => setArtworkFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              </div>

              <div className="card p-4 space-y-1.5">
                <div className="flex justify-between text-sm text-text-secondary dark:text-stone-400">
                  <span>Subtotal</span><span>{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-sm text-text-secondary dark:text-stone-400">
                  <span>Frete</span><span>{formatCurrency(shipping?.price ?? 0)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-text-primary dark:text-stone-100 pt-1.5 border-t border-border dark:border-border-dark">
                  <span>Total</span><span>{formatCurrency(total + (shipping?.price ?? 0))}</span>
                </div>
              </div>

              <div className="space-y-2">
                {!loadingOnlinePayment && onlinePaymentAvailable && (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold disabled:opacity-50 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--store-primary)', color: 'var(--store-button-text)' }}
                  >
                    {submittingVia === 'online' && <Loader2 size={15} className="animate-spin" />}
                    Finalizar pelo site
                  </button>
                )}
                {storeWhatsapp && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => submitOrder('whatsapp')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 transition-colors disabled:opacity-50"
                  >
                    {submittingVia === 'whatsapp' ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={16} />}
                    Finalizar pelo WhatsApp
                  </button>
                )}
                {!loadingOnlinePayment && onlinePaymentAvailable && (
                  <p className="text-[11px] text-text-muted text-center">
                    Pelo site, o pagamento é confirmado automaticamente. Pelo WhatsApp, você combina o pagamento direto com a loja.
                  </p>
                )}
              </div>
            </form>
          </div>
            )}
          </>
        )}
      </div>
    </div>
    </StoreThemeRoot>
  )
}
