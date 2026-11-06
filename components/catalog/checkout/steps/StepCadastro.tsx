'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { fetchCepData } from '@/lib/services/cep'
import { useToast } from '@/components/ui/Toaster'
import type { CheckoutCustomer } from '@/lib/catalog/checkout/useCheckoutState'

interface StepCadastroProps {
  slug: string
  customer: CheckoutCustomer
  onChange: (patch: Partial<CheckoutCustomer>) => void
  onNext: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Etapa 1 — Cadastro do cliente. Reaproveita a busca de CEP já existente
 * (lib/services/cep) e, ao sair do campo de telefone, tenta pré-preencher
 * com um cliente já cadastrado nesta loja (sempre editável pelo cliente).
 * Endereço é opcional aqui — só passa a ser exigido na Etapa 3 (Entrega)
 * quando o cliente escolhe uma transportadora em vez de retirada no local.
 */
export function StepCadastro({ slug, customer, onChange, onNext }: StepCadastroProps) {
  const { toast } = useToast()
  const [lookingUpCep, setLookingUpCep] = useState(false)
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false)
  const [prefilled, setPrefilled] = useState(false)

  async function lookupCep() {
    const cep = customer.cep.replace(/\D/g, '')
    if (cep.length !== 8) return
    setLookingUpCep(true)
    try {
      const result = await fetchCepData(cep)
      if (result.ok) {
        onChange({
          street: result.data.logradouro || customer.street,
          neighborhood: result.data.bairro || customer.neighborhood,
          city: result.data.cidade || customer.city,
          state: result.data.uf || customer.state,
        })
      }
    } finally {
      setLookingUpCep(false)
    }
  }

  async function lookupCustomerByPhone() {
    const phone = customer.phone.replace(/\D/g, '')
    if (phone.length < 10 || prefilled) return
    setLookingUpCustomer(true)
    try {
      const res = await fetch(`/api/loja/cliente-por-telefone?slug=${encodeURIComponent(slug)}&phone=${phone}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.customer) {
        setPrefilled(true)
        onChange({
          name: customer.name || data.customer.name,
          email: customer.email || data.customer.email,
          cpfCnpj: customer.cpfCnpj || data.customer.cpfCnpj,
          city: customer.city || data.customer.city,
          state: customer.state || data.customer.state,
        })
        toast('success', 'Encontramos seu cadastro — confira os dados abaixo.')
      }
    } catch { /* prefill é best-effort */ } finally {
      setLookingUpCustomer(false)
    }
  }

  function handleNext() {
    if (!customer.name.trim()) { toast('error', 'Informe seu nome completo'); return }
    if (customer.phone.replace(/\D/g, '').length < 10) { toast('error', 'Informe um WhatsApp válido, com DDD'); return }
    if (customer.email && !EMAIL_RE.test(customer.email)) { toast('error', 'E-mail inválido'); return }
    onNext()
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--store-text)' }}>Seus dados</h3>
          <p className="text-xs" style={{ color: 'var(--store-text-secondary)' }}>
            Usamos isso para falar com você sobre o pedido e a produção da arte.
          </p>
        </div>

        <input
          required
          className="input"
          placeholder="Nome completo"
          value={customer.name}
          onChange={e => onChange({ name: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <input
              required
              className="input w-full"
              placeholder="WhatsApp (com DDD)"
              value={customer.phone}
              onChange={e => onChange({ phone: e.target.value })}
              onBlur={lookupCustomerByPhone}
            />
            {lookingUpCustomer && <Loader2 size={14} className="animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />}
          </div>
          <input
            type="email"
            className="input"
            placeholder="E-mail"
            value={customer.email}
            onChange={e => onChange({ email: e.target.value })}
          />
        </div>
        <input
          className="input"
          placeholder="CPF/CNPJ (opcional)"
          value={customer.cpfCnpj}
          onChange={e => onChange({ cpfCnpj: e.target.value })}
        />
      </div>

      <div className="card p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--store-text)' }}>Endereço</h3>
          <p className="text-xs" style={{ color: 'var(--store-text-secondary)' }}>
            Só é obrigatório se você escolher entrega por transportadora na próxima etapa — retirada no local não exige endereço.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              className="input w-full"
              placeholder="CEP"
              value={customer.cep}
              onChange={e => onChange({ cep: e.target.value })}
              onBlur={lookupCep}
            />
            {lookingUpCep && <Loader2 size={14} className="animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input className="input col-span-2" placeholder="Rua / Logradouro" value={customer.street} onChange={e => onChange({ street: e.target.value })} />
          <input className="input" placeholder="Número" value={customer.number} onChange={e => onChange({ number: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="Complemento (opcional)" value={customer.complement} onChange={e => onChange({ complement: e.target.value })} />
          <input className="input" placeholder="Bairro" value={customer.neighborhood} onChange={e => onChange({ neighborhood: e.target.value })} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input className="input col-span-2" placeholder="Cidade" value={customer.city} onChange={e => onChange({ city: e.target.value })} />
          <input className="input" placeholder="UF" maxLength={2} value={customer.state} onChange={e => onChange({ state: e.target.value.toUpperCase() })} />
        </div>
      </div>

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
