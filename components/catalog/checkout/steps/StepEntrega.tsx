'use client'

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react'
import { Loader2, Truck, Store, Info } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { useToast } from '@/components/ui/Toaster'
import type {
  CheckoutCustomer, CheckoutShippingSelection, FulfillmentMethod, PickupChoice,
} from '@/lib/catalog/checkout/useCheckoutState'

interface StoreAddress {
  address: string | null
  city: string | null
  state: string | null
}

interface StepEntregaProps {
  customer: CheckoutCustomer
  onChangeCustomer: (patch: Partial<CheckoutCustomer>) => void
  fulfillmentMethod: FulfillmentMethod | null
  pickupChoice: PickupChoice | null
  onSetFulfillment: (method: FulfillmentMethod | null, pickup?: PickupChoice | null) => void
  shipping: CheckoutShippingSelection | null
  shippingOptions: CheckoutShippingSelection[]
  calculating: boolean
  onCalcShipping: () => void
  onSelectShipping: (opt: CheckoutShippingSelection) => void
  storeAddress: StoreAddress
  onNext: () => void
}

/**
 * Etapa 3 — Entrega. Duas categorias: entrega por transportadora (cotação
 * real via SuperFrete, nunca simulada) ou retirada no local (grátis, sem
 * exigir endereço de entrega).
 */
export function StepEntrega({
  customer, onChangeCustomer, fulfillmentMethod, pickupChoice, onSetFulfillment,
  shipping, shippingOptions, calculating, onCalcShipping, onSelectShipping,
  storeAddress, onNext,
}: StepEntregaProps) {
  const { toast } = useToast()
  const [cepTouched, setCepTouched] = useState(false)

  function handleNext() {
    if (fulfillmentMethod === 'shipping') {
      if (!shipping) { toast('error', 'Calcule e escolha uma opção de frete antes de continuar'); return }
    } else if (fulfillmentMethod === 'pickup') {
      if (!pickupChoice) { toast('error', 'Escolha como você vai retirar o pedido'); return }
    } else {
      toast('error', 'Escolha como você quer receber o pedido'); return
    }
    onNext()
  }

  const pickupAddressLine = storeAddress.address
    ? [storeAddress.address, [storeAddress.city, storeAddress.state].filter(Boolean).join(' - ')].filter(Boolean).join(', ')
    : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSetFulfillment('shipping')}
          className="text-left p-3 rounded-lg border text-sm transition-colors"
          style={fulfillmentMethod === 'shipping'
            ? { borderColor: 'var(--store-primary)', backgroundColor: 'var(--store-surface)' }
            : { borderColor: 'var(--store-border)' }}
        >
          <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--store-text)' }}>
            <Truck size={14} /> Entrega por transportadora
          </span>
          <span className="block text-xs mt-0.5" style={{ color: 'var(--store-text-secondary)' }}>
            Frete calculado pelo CEP, com prazo e valor reais.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onSetFulfillment('pickup')}
          className="text-left p-3 rounded-lg border text-sm transition-colors"
          style={fulfillmentMethod === 'pickup'
            ? { borderColor: 'var(--store-primary)', backgroundColor: 'var(--store-surface)' }
            : { borderColor: 'var(--store-border)' }}
        >
          <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--store-text)' }}>
            <Store size={14} /> Retirada no local — Grátis
          </span>
          <span className="block text-xs mt-0.5" style={{ color: 'var(--store-text-secondary)' }}>
            Você ou um entregador buscam no endereço da loja.
          </span>
        </button>
      </div>

      {fulfillmentMethod === 'shipping' && (
        <div className="card p-4 space-y-3">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="CEP de entrega"
              value={customer.cep}
              onChange={e => { onChangeCustomer({ cep: e.target.value }); setCepTouched(true) }}
            />
            <button type="button" onClick={onCalcShipping} disabled={calculating} className="btn-secondary whitespace-nowrap">
              {calculating ? <Loader2 size={15} className="animate-spin" /> : 'Calcular frete'}
            </button>
          </div>
          {!cepTouched && !customer.street && (
            <p className="text-xs" style={{ color: 'var(--store-text-secondary)' }}>
              Informe o CEP de entrega — se mudar, calcule o frete novamente.
            </p>
          )}

          {shippingOptions.length > 0 && (
            <div className="space-y-1.5">
              {shippingOptions.map(opt => (
                <label
                  key={`${opt.serviceId ?? opt.service}`}
                  className="flex items-center justify-between gap-2 text-sm p-2.5 rounded-lg border cursor-pointer"
                  style={{ borderColor: shipping?.service === opt.service && shipping?.carrier === opt.carrier ? 'var(--store-primary)' : 'var(--store-border)' }}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <input
                      type="radio"
                      name="shipping-option"
                      checked={shipping?.service === opt.service && shipping?.carrier === opt.carrier}
                      onChange={() => onSelectShipping(opt)}
                    />
                    {opt.carrierLogo && (
                      <img src={opt.carrierLogo} alt={opt.carrier ?? ''} className="w-6 h-6 object-contain rounded shrink-0" />
                    )}
                    <span className="min-w-0 truncate">
                      <span className="font-medium" style={{ color: 'var(--store-text)' }}>{opt.carrier ? `${opt.carrier} · ` : ''}{opt.service}</span>
                      <span className="block text-xs" style={{ color: 'var(--store-text-secondary)' }}>{opt.days} dia(s) úteis</span>
                    </span>
                  </span>
                  <span className="font-semibold shrink-0">{formatCurrency(opt.price)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {fulfillmentMethod === 'pickup' && (
        <div className="card p-4 space-y-3">
          <div className="flex items-start gap-2 text-xs p-2.5 rounded-lg" style={{ backgroundColor: 'var(--store-surface)', color: 'var(--store-text-secondary)' }}>
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>
              {pickupAddressLine ? <>Endereço: <strong>{pickupAddressLine}</strong>. </> : null}
              Seu pedido poderá ser retirado pessoalmente ou por um entregador solicitado por você.
              Avisaremos quando estiver pronto para combinar o horário da retirada.
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSetFulfillment('pickup', 'self')}
              className="text-left p-3 rounded-lg border text-sm transition-colors"
              style={pickupChoice === 'self'
                ? { borderColor: 'var(--store-primary)', backgroundColor: 'var(--store-surface)' }
                : { borderColor: 'var(--store-border)' }}
            >
              <span className="font-medium" style={{ color: 'var(--store-text)' }}>Vou retirar pessoalmente</span>
            </button>
            <button
              type="button"
              onClick={() => onSetFulfillment('pickup', 'uber_flash')}
              className="text-left p-3 rounded-lg border text-sm transition-colors"
              style={pickupChoice === 'uber_flash'
                ? { borderColor: 'var(--store-primary)', backgroundColor: 'var(--store-surface)' }
                : { borderColor: 'var(--store-border)' }}
            >
              <span className="font-medium" style={{ color: 'var(--store-text)' }}>Vou enviar um Uber Flash / entregador</span>
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleNext}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--store-primary)', color: 'var(--store-button-text)' }}
      >
        Continuar
      </button>
    </div>
  )
}
