'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/lib/catalog/useCart'
import { useToast } from '@/components/ui/Toaster'
import { formatCurrency } from '@/lib/utils/format'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { StoreThemeRoot } from '@/components/catalog/storefront/StoreThemeRoot'
import { StoreHeader } from '@/components/catalog/storefront/StoreHeader'
import { useProductFavorites } from '@/lib/catalog/useProductFavorites'
import { resolvePalettes } from '@/lib/catalog/theme/palette'
import { useCheckoutState, CHECKOUT_STEPS, type CheckoutStep } from '@/lib/catalog/checkout/useCheckoutState'
import { StepIndicator } from '@/components/catalog/checkout/StepIndicator'
import { StepCadastro } from '@/components/catalog/checkout/steps/StepCadastro'
import { StepProdutoArte } from '@/components/catalog/checkout/steps/StepProdutoArte'
import { StepEntrega } from '@/components/catalog/checkout/steps/StepEntrega'
import { StepPagamento, type PendingOrder, type OnlinePaymentInfo } from '@/components/catalog/checkout/steps/StepPagamento'

/**
 * Checkout da loja — reformulado em 4 etapas (Cadastro / Produto e arte /
 * Entrega / Pagamento), todas isoladas e reais: StepCadastro, StepProdutoArte,
 * StepEntrega e StepPagamento (Pix/cartão inline via Payment Brick do
 * Mercado Pago, ou WhatsApp).
 */
export default function CheckoutLojaPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const { items, updateQty, updateNotes, removeItem, total, clear } = useCart(slug)
  const checkout = useCheckoutState(slug)

  const { data: storeSettings } = useQuery<{ whatsapp: string | null; logo_url: string | null; theme_color: string; theme_palette: import('@/lib/catalog/theme/palette').StoreThemePalettes | null; address: string | null; city: string | null; state: string | null; companies: { name: string } | null } | null>({
    queryKey: ['loja-checkout-settings', slug],
    queryFn: async () => {
      const { data, error } = await (supabase.from('catalog_settings') as any)
        .select('whatsapp, logo_url, theme_color, theme_palette, address, city, state, companies(name)').eq('slug', slug).maybeSingle()
      if (error) throw error
      return data ?? null
    },
  })
  const storeWhatsapp = storeSettings?.whatsapp ?? null
  const storeName = storeSettings?.companies?.name ?? slug
  const palettes = resolvePalettes(storeSettings ?? { theme_color: '#8B6C4F', theme_palette: null })
  const { favoriteIds } = useProductFavorites(slug)
  const cartCount = items.reduce((s, i) => s + i.quantity, 0)

  // Sem conexão Mercado Pago ativa (ou sem Pix/cartão habilitado) da
  // empresa, "Pagar com Pix ou cartão" não aparece — só "Finalizar pelo
  // WhatsApp", igual já acontece hoje para produtos em modo "quote".
  const { data: onlinePayment, isLoading: loadingOnlinePayment } = useQuery<OnlinePaymentInfo>({
    queryKey: ['loja-checkout-pagamento-online', slug],
    queryFn: async () => {
      const res = await fetch(`/api/loja/pagamento-online?slug=${encodeURIComponent(slug)}`)
      if (!res.ok) return { available: false }
      return res.json()
    },
  })

  const customer = checkout.customer
  const [shippingOptions, setShippingOptions] = useState<import('@/lib/catalog/checkout/useCheckoutState').CheckoutShippingSelection[]>([])
  const [calculatingShipping, setCalculatingShipping] = useState(false)
  const shipping = checkout.shipping
  const shippingPrice = checkout.fulfillmentMethod === 'pickup' ? 0 : (shipping?.price ?? 0)

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
    const lines = [
      `Olá! Quero finalizar meu pedido na loja ${slug}.`,
      `Pedido: ${orderNumber}`,
      '',
      'Produtos:',
      ...items.map(i => `- ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ''} — ${i.quantity}x — ${formatCurrency(i.price)}`),
      '',
      `Subtotal: ${formatCurrency(total)}`,
    ]
    if (checkout.fulfillmentMethod === 'pickup') {
      lines.push('Entrega: Retirada no local')
    } else if (shipping) {
      lines.push(`Frete: ${formatCurrency(shippingPrice)} (${shipping.service})`)
    }
    lines.push(`Total: ${formatCurrency(total + shippingPrice)}`)
    if (checkout.fulfillmentMethod === 'shipping' && customer.cep) lines.push(`Meu CEP: ${customer.cep}`)
    lines.push('', 'Podem me orientar sobre a finalização do pagamento?')
    return lines.join('\n')
  }

  function validateBeforeSubmit(fulfillment: 'online' | 'whatsapp'): boolean {
    if (items.length === 0) { toast('error', 'Seu carrinho está vazio'); return false }
    if (!customer.name || !customer.phone) { toast('error', 'Nome e telefone são obrigatórios'); return false }
    if (fulfillment === 'online' && !customer.email) { toast('error', 'Informe seu e-mail para receber a confirmação do pagamento'); return false }
    if (fulfillment === 'whatsapp' && !storeWhatsapp) { toast('error', 'Esta loja não configurou um WhatsApp para atendimento.'); return false }
    if (checkout.fulfillmentMethod === 'shipping' && !shipping) { toast('error', 'Volte à etapa de entrega e calcule o frete'); return false }
    if (checkout.fulfillmentMethod === 'pickup' && !checkout.pickupChoice) { toast('error', 'Volte à etapa de entrega e escolha como retirar o pedido'); return false }
    return true
  }

  /** Cria o pedido pendente no banco — a cobrança (Pix/cartão) só acontece depois, na própria Etapa 4. */
  async function createPendingOrder(fulfillment: 'online' | 'whatsapp'): Promise<{ orderNumber: string; checkoutRef: string; total: number } | null> {
    if (!validateBeforeSubmit(fulfillment)) return null
    try {
      const res = await fetch('/api/loja/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          items: items.map(i => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity, notes: i.notes ?? null })),
          customer,
          // A arte de cada item já foi enviada/descrita na Etapa 2 — os
          // arquivos (ownFiles/referenceFiles) já têm url/path do Storage,
          // só o briefing e as referências são relidos aqui pelo servidor.
          itemsArt: checkout.itemsArt,
          fulfillmentMethod: checkout.fulfillmentMethod,
          pickupChoice: checkout.pickupChoice,
          // O preço do frete NUNCA é enviado — o servidor recota a mesma
          // modalidade escolhida (shippingService) a partir do CEP e dos
          // produtos reais antes de cobrar (ver /api/loja/checkout). Sem
          // efeito quando fulfillmentMethod = pickup (retirada é grátis).
          shippingService: checkout.fulfillmentMethod === 'shipping' ? (shipping?.service ?? null) : null,
          shippingCep: checkout.fulfillmentMethod === 'shipping' && customer.cep ? customer.cep.replace(/\D/g, '') : null,
          fulfillment,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Erro ao criar o pedido. Tente novamente.')
      if (!data) throw new Error('Resposta inesperada do servidor. Tente novamente.')
      return data
    } catch (err: any) {
      toast('error', err.message)
      return null
    }
  }

  async function handleCreateOnlineOrder(): Promise<PendingOrder | null> {
    const data = await createPendingOrder('online')
    if (!data) return null
    return { orderId: '', orderNumber: data.orderNumber, checkoutRef: data.checkoutRef, total: data.total }
  }

  async function handleFinalizeWhatsapp() {
    const data = await createPendingOrder('whatsapp')
    if (!data) return
    // Abrir o WhatsApp não significa que a mensagem foi enviada nem que o
    // pedido foi pago — ele continua "pending" até o lojista confirmar
    // manualmente no painel. Só o carrinho é limpo aqui.
    const message = buildWhatsappMessage(data.orderNumber)
    window.open(`https://wa.me/${storeWhatsapp!.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank', 'noreferrer')
    clear()
    checkout.reset()
    toast('success', `Pedido ${data.orderNumber} criado! Continue pelo WhatsApp.`)
    router.push(`/loja/${slug}`)
  }

  function handlePaid(checkoutRef: string) {
    clear()
    checkout.reset()
    toast('success', 'Pagamento confirmado!')
    router.push(`/loja/${slug}/pedido/${checkoutRef}`)
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

            {checkout.step === 'produto_arte' && (
              <StepProdutoArte
                slug={slug}
                items={items}
                itemsArt={checkout.itemsArt}
                onChangeItemArt={checkout.patchItemArt}
                onChangeItemArtBrief={checkout.patchItemArtBrief}
                onUpdateQty={updateQty}
                onUpdateNotes={updateNotes}
                onRemoveItem={removeItem}
                onNext={checkout.goNext}
              />
            )}

            {checkout.step === 'entrega' && (
              <StepEntrega
                customer={customer}
                onChangeCustomer={checkout.patchCustomer}
                fulfillmentMethod={checkout.fulfillmentMethod}
                pickupChoice={checkout.pickupChoice}
                onSetFulfillment={checkout.setFulfillment}
                shipping={shipping}
                shippingOptions={shippingOptions}
                calculating={calculatingShipping}
                onCalcShipping={calcShipping}
                onSelectShipping={checkout.setShipping}
                storeAddress={{ address: storeSettings?.address ?? null, city: storeSettings?.city ?? null, state: storeSettings?.state ?? null }}
                onNext={checkout.goNext}
              />
            )}

            {checkout.step === 'pagamento' && (
              <StepPagamento
                slug={slug}
                customerEmail={customer.email}
                subtotal={total}
                shippingPrice={shippingPrice}
                deliverySummary={
                  checkout.fulfillmentMethod === 'pickup'
                    ? `Retirada no local — Grátis · ${checkout.pickupChoice === 'uber_flash' ? 'você enviará um entregador' : 'você retirará pessoalmente'}`
                    : shipping
                      ? `${shipping.carrier ? `${shipping.carrier} · ` : ''}${shipping.service} · ${shipping.days} dia(s)`
                      : ''
                }
                onlinePayment={onlinePayment}
                loadingOnlinePayment={loadingOnlinePayment}
                storeWhatsapp={storeWhatsapp}
                onCreateOnlineOrder={handleCreateOnlineOrder}
                onFinalizeWhatsapp={handleFinalizeWhatsapp}
                onPaid={handlePaid}
              />
            )}
          </>
        )}
      </div>
    </div>
    </StoreThemeRoot>
  )
}
