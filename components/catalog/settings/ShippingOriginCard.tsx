'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Truck, Loader2, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'

interface ShippingOriginForm {
  sender_name: string
  sender_document: string
  sender_phone: string
  origin_cep: string
  origin_street: string
  origin_number: string
  origin_complement: string
  origin_district: string
  origin_city: string
  origin_state: string
  default_weight_kg: number
  default_length_cm: number
  default_width_cm: number
  default_height_cm: number
}

const EMPTY: ShippingOriginForm = {
  sender_name: '', sender_document: '', sender_phone: '',
  origin_cep: '', origin_street: '', origin_number: '', origin_complement: '',
  origin_district: '', origin_city: '', origin_state: '',
  default_weight_kg: 0.3, default_length_cm: 20, default_width_cm: 15, default_height_cm: 5,
}

/**
 * Endereço de origem/remetente usado pela SuperFrete para cotar e gerar
 * etiquetas — exclusivo desta empresa (nunca um CEP fixo compartilhado).
 * Sem isso configurado, o frete e a geração de etiqueta ficam bloqueados
 * (ver /api/loja/frete e /api/pedidos/[id]/etiqueta).
 */
export function ShippingOriginCard({ companyId }: { companyId: string | null }) {
  const supabase = createClient()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [form, setFormState] = useState<ShippingOriginForm | null>(null)
  const [cepLoading, setCepLoading] = useState(false)

  const { data, isLoading } = useQuery<ShippingOriginForm>({
    queryKey: ['catalog_shipping_settings', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('catalog_shipping_settings') as any)
        .select('*')
        .eq('company_id', companyId!)
        .maybeSingle()
      return data ?? EMPTY
    },
  })

  useEffect(() => { if (data && !form) setFormState(data) }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = form ?? data ?? EMPTY
  function setForm(patch: Partial<ShippingOriginForm>) {
    setFormState({ ...current, ...patch })
  }

  async function lookupCep() {
    const cep = current.origin_cep.replace(/\D/g, '')
    if (cep.length !== 8) { toast('error', 'Informe um CEP válido'); return }
    setCepLoading(true)
    try {
      const res = await fetch(`/api/cep/${cep}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'CEP não encontrado')
      setForm({
        origin_street: json.data.logradouro ?? current.origin_street,
        origin_district: json.data.bairro ?? current.origin_district,
        origin_city: json.data.cidade ?? current.origin_city,
        origin_state: json.data.uf ?? current.origin_state,
      })
    } catch (err: any) {
      toast('error', err.message)
    } finally {
      setCepLoading(false)
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (settings: ShippingOriginForm) => {
      if (!settings.sender_name || !settings.sender_document || !settings.sender_phone) {
        throw new Error('Nome, CPF/CNPJ e telefone do remetente são obrigatórios')
      }
      if (settings.origin_cep.replace(/\D/g, '').length !== 8) throw new Error('CEP de origem inválido')
      if (!settings.origin_street || !settings.origin_number || !settings.origin_district || !settings.origin_city || !settings.origin_state) {
        throw new Error('Preencha o endereço de origem completo')
      }
      const { error } = await (supabase.from('catalog_shipping_settings') as any)
        .upsert([{ company_id: companyId, ...settings, origin_cep: settings.origin_cep.replace(/\D/g, '') }], { onConflict: 'company_id' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog_shipping_settings', companyId] })
      toast('success', 'Dados de envio salvos.')
    },
    onError: (err: Error) => toast('error', err.message),
  })

  if (isLoading) return <div className="card p-5 text-sm text-text-muted">Carregando…</div>

  return (
    <div className="card p-5 space-y-3">
      <div>
        <h3 className="text-base font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
          <Truck size={17} className="text-primary" /> Dados de Envio
        </h3>
        <p className="text-sm text-text-secondary dark:text-stone-400 mt-1">
          Endereço de origem e remetente usados para calcular o frete e gerar etiquetas pela SuperFrete.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className="input" placeholder="Nome do remetente (ou razão social)" value={current.sender_name} onChange={e => setForm({ sender_name: e.target.value })} />
        <input className="input" placeholder="CPF/CNPJ" value={current.sender_document} onChange={e => setForm({ sender_document: e.target.value })} />
        <input className="input sm:col-span-2" placeholder="Telefone" value={current.sender_phone} onChange={e => setForm({ sender_phone: e.target.value })} />
      </div>

      <div className="flex gap-2">
        <input className="input flex-1" placeholder="CEP de origem" value={current.origin_cep} onChange={e => setForm({ origin_cep: e.target.value })} />
        <button type="button" onClick={lookupCep} disabled={cepLoading} className="btn-secondary whitespace-nowrap flex items-center gap-1.5">
          {cepLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Buscar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input className="input sm:col-span-2" placeholder="Rua" value={current.origin_street} onChange={e => setForm({ origin_street: e.target.value })} />
        <input className="input" placeholder="Número" value={current.origin_number} onChange={e => setForm({ origin_number: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input className="input" placeholder="Complemento (opcional)" value={current.origin_complement} onChange={e => setForm({ origin_complement: e.target.value })} />
        <input className="input" placeholder="Bairro" value={current.origin_district} onChange={e => setForm({ origin_district: e.target.value })} />
        <input className="input" placeholder="Cidade" value={current.origin_city} onChange={e => setForm({ origin_city: e.target.value })} />
      </div>
      <input className="input sm:w-32" placeholder="UF" maxLength={2} value={current.origin_state} onChange={e => setForm({ origin_state: e.target.value.toUpperCase() })} />

      <div>
        <p className="text-xs font-semibold text-text-secondary dark:text-stone-400 mb-2">Peso/dimensões padrão (usados quando um produto não tem os próprios)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <input type="number" step="0.01" min="0.01" className="input" placeholder="Peso (kg)" value={current.default_weight_kg} onChange={e => setForm({ default_weight_kg: Number(e.target.value) })} />
          <input type="number" step="1" min="1" className="input" placeholder="Compr. (cm)" value={current.default_length_cm} onChange={e => setForm({ default_length_cm: Number(e.target.value) })} />
          <input type="number" step="1" min="1" className="input" placeholder="Largura (cm)" value={current.default_width_cm} onChange={e => setForm({ default_width_cm: Number(e.target.value) })} />
          <input type="number" step="1" min="1" className="input" placeholder="Altura (cm)" value={current.default_height_cm} onChange={e => setForm({ default_height_cm: Number(e.target.value) })} />
        </div>
      </div>

      <button type="button" onClick={() => saveMutation.mutate(current)} disabled={saveMutation.isPending} className="btn-primary flex items-center gap-2">
        {saveMutation.isPending && <Loader2 size={15} className="animate-spin" />}
        Salvar dados de envio
      </button>
    </div>
  )
}
