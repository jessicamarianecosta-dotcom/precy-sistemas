'use client'

/**
 * Modal de preenchimento rápido dos dados fiscais do destinatário
 * (CPF/CNPJ + endereço completo + bairro), usado pelas telas de nota
 * fiscal (por pedido e avulsa) quando `getMissingFields` aponta algo
 * faltando no cliente — para a usuária não precisar sair do Precy+
 * (nem entrar no Bling) para completar o cadastro.
 *
 * Atualiza a tabela `customers` diretamente (mesmo padrão usado em
 * app/(dashboard)/clientes/page.tsx), e NÃO toca em nada da integração
 * Bling — só evita que `getMissingFields` continue bloqueando a emissão.
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { formatCnpj, formatCpf, formatCep, onlyDigits, isValidCnpjLength } from '@/lib/utils/mask'
import { useCnpjLookup } from '@/hooks/useCnpjLookup'
import { useCepLookup } from '@/hooks/useCepLookup'
import { X, Loader2, Search, MapPin } from 'lucide-react'

export interface DestinatarioFiscalEditavel {
  id: string
  name: string
  person_type?: string | null
  cpf_cnpj?: string | null
  zip_code?: string | null
  street?: string | null
  number?: string | null
  complement?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
      {children}
    </label>
  )
}

export function CompletarDestinatarioModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: DestinatarioFiscalEditavel
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const { toast } = useToast()

  const isPj = customer.person_type === 'pj' || customer.person_type === 'juridica'
    || (!customer.person_type && onlyDigits(customer.cpf_cnpj).length > 11)

  const [form, setForm] = useState({
    cpf_cnpj: customer.cpf_cnpj ? (isPj ? formatCnpj(customer.cpf_cnpj) : formatCpf(customer.cpf_cnpj)) : '',
    zip_code: customer.zip_code ? formatCep(customer.zip_code) : '',
    street: customer.street ?? '',
    number: customer.number ?? '',
    complement: customer.complement ?? '',
    neighborhood: customer.neighborhood ?? '',
    city: customer.city ?? '',
    state: customer.state ?? '',
  })

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const cepLookup = useCepLookup({
    onFound: data => {
      if (data.logradouro) set('street', data.logradouro)
      if (data.bairro) set('neighborhood', data.bairro)
      if (data.cidade) set('city', data.cidade)
      if (data.uf) set('state', data.uf)
    },
  })

  const cnpjLookup = useCnpjLookup({
    onFound: data => {
      if (data.cep) set('zip_code', formatCep(data.cep))
      if (data.logradouro) set('street', data.logradouro)
      if (data.numero) set('number', data.numero)
      if (data.complemento) set('complement', data.complemento)
      if (data.bairro) set('neighborhood', data.bairro)
      if (data.cidade) set('city', data.cidade)
      if (data.uf) set('state', data.uf)
      toast('success', 'Endereço encontrado pelo CNPJ.')
    },
  })

  async function handleBuscarCnpj() {
    if (!isValidCnpjLength(form.cpf_cnpj)) {
      toast('error', 'Digite um CNPJ válido com 14 dígitos.')
      return
    }
    const result = await cnpjLookup.search(form.cpf_cnpj)
    if (!result.ok) {
      toast(result.status === 'unavailable' || result.status === 'timeout' ? 'warning' : 'error', result.message)
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        cpf_cnpj: onlyDigits(form.cpf_cnpj) || null,
        zip_code: onlyDigits(form.zip_code) || null,
        street: form.street.trim() || null,
        number: form.number.trim() || null,
        complement: form.complement.trim() || null,
        neighborhood: form.neighborhood.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim().toUpperCase() || null,
        updated_at: new Date().toISOString(),
      }
      const { error } = await (supabase.from('customers') as any).update(payload).eq('id', customer.id)
      if (error) {
        if (error.code === '23505') throw new Error('Já existe outro cliente cadastrado com esse CPF/CNPJ.')
        throw new Error(error.message)
      }
    },
    onSuccess: () => {
      toast('success', 'Dados do cliente atualizados.')
      onSaved()
    },
    onError: (err: Error) => toast('error', err.message),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl shadow-modal max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border dark:border-border-dark">
          <div>
            <h2 className="text-base font-semibold text-text-primary dark:text-stone-100">Completar dados fiscais</h2>
            <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">
              {customer.name} — fica salvo no cadastro do cliente, não precisa editar no Bling.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); saveMutation.mutate() }} className="p-6 space-y-4">
          <div>
            <FieldLabel>{isPj ? 'CNPJ' : 'CPF'}</FieldLabel>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                placeholder={isPj ? '00.000.000/0001-00' : '000.000.000-00'}
                className="input flex-1"
                value={form.cpf_cnpj}
                onChange={e => set('cpf_cnpj', isPj ? formatCnpj(e.target.value) : formatCpf(e.target.value))}
              />
              {isPj && (
                <button
                  type="button"
                  onClick={handleBuscarCnpj}
                  disabled={cnpjLookup.loading}
                  className="btn-secondary flex items-center justify-center gap-2 whitespace-nowrap px-4 disabled:opacity-60"
                >
                  {cnpjLookup.loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  {cnpjLookup.loading ? 'Buscando...' : 'Buscar CNPJ'}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>CEP</FieldLabel>
              <div className="relative">
                <input
                  placeholder="00000-000"
                  className="input pr-8"
                  value={form.zip_code}
                  onChange={e => {
                    const formatted = formatCep(e.target.value)
                    set('zip_code', formatted)
                    cepLookup.searchOnComplete(formatted)
                  }}
                />
                {cepLookup.loading && (
                  <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
                )}
              </div>
            </div>
            <div>
              <FieldLabel>Logradouro</FieldLabel>
              <input placeholder="Rua, Av..." className="input" value={form.street} onChange={e => set('street', e.target.value)} />
            </div>
            <div>
              <FieldLabel>Número</FieldLabel>
              <input placeholder="123" className="input" value={form.number} onChange={e => set('number', e.target.value)} />
            </div>
            <div>
              <FieldLabel>Complemento</FieldLabel>
              <input placeholder="Sala, bloco..." className="input" value={form.complement} onChange={e => set('complement', e.target.value)} />
            </div>
            <div>
              <FieldLabel>Bairro</FieldLabel>
              <input placeholder="Bairro" className="input" value={form.neighborhood} onChange={e => set('neighborhood', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Cidade</FieldLabel>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input placeholder="São Paulo" className="input pl-9" value={form.city} onChange={e => set('city', e.target.value)} />
                </div>
              </div>
              <div>
                <FieldLabel>UF</FieldLabel>
                <input placeholder="SP" maxLength={2} className="input uppercase" value={form.state} onChange={e => set('state', e.target.value.toUpperCase())} />
              </div>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-2 p-6 pt-4 border-t border-border dark:border-border-dark">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {saveMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
            Salvar dados do cliente
          </button>
        </div>
      </div>
    </div>
  )
}
