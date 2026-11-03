'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { useCompanyId } from '@/hooks/useCompanyId'
import { clsx } from 'clsx'
import { CreditCard, Loader2, CheckCircle2, AlertTriangle, Unplug, ExternalLink } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'

interface MercadoPagoConnection {
  id: string
  mp_nickname: string | null
  live_mode: boolean
  pix_enabled: boolean
  card_enabled: boolean
  installments_default: number
  fee_absorption: 'pass_to_customer' | 'absorb'
  status: 'connected' | 'disconnected' | 'error'
  last_error: string | null
  connected_at: string | null
}

interface FeeRule {
  payment_method: string
  installments_min: number
  installments_max: number
  fee_percent: number
  fee_fixed: number
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'Pix',
  debit_card: 'Cartão de débito',
  credit_card: 'Cartão de crédito',
}

export function PagamentosTab() {
  const supabase = createClient()
  const { companyId } = useCompanyId()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Retorno do fluxo OAuth (api/mercadopago/oauth/callback) — mostra o
  // resultado uma vez e limpa a URL, sem deixar ?mp=... preso na barra de
  // endereço.
  useEffect(() => {
    const mp = searchParams.get('mp')
    if (!mp) return
    const msg = searchParams.get('mp_msg')
    if (mp === 'success') toast('success', 'Conta do Mercado Pago conectada com sucesso!')
    else if (mp === 'error') toast('error', msg || 'Não foi possível conectar com o Mercado Pago')

    const url = new URL(window.location.href)
    url.searchParams.delete('mp')
    url.searchParams.delete('mp_msg')
    const qs = url.searchParams.toString()
    router.replace(qs ? `${url.pathname}?${qs}` : url.pathname)
  }, [searchParams, toast, router])

  const { data: connection, isLoading } = useQuery<MercadoPagoConnection | null>({
    queryKey: ['mercadopago_connection', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('mercadopago_connections') as any)
        .select('id, mp_nickname, live_mode, pix_enabled, card_enabled, installments_default, fee_absorption, status, last_error, connected_at')
        .eq('company_id', companyId!)
        .maybeSingle()
      return data ?? null
    },
  })

  const { data: feeRules } = useQuery<FeeRule[]>({
    queryKey: ['payment_fee_rules'],
    queryFn: async () => {
      const { data } = await (supabase.from('payment_fee_rules') as any)
        .select('payment_method, installments_min, installments_max, fee_percent, fee_fixed')
        .eq('active', true)
        .order('payment_method', { ascending: true })
        .order('installments_min', { ascending: true })
      return data ?? []
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (patch: Partial<MercadoPagoConnection>) => {
      const { error } = await (supabase.from('mercadopago_connections') as any)
        .update(patch)
        .eq('company_id', companyId!)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mercadopago_connection', companyId] })
      toast('success', 'Preferências de pagamento atualizadas')
    },
    onError: (err: Error) => toast('error', err.message),
  })

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from('mercadopago_connections') as any)
        .update({ status: 'disconnected', disconnected_at: new Date().toISOString() })
        .eq('company_id', companyId!)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mercadopago_connection', companyId] })
      toast('success', 'Conta do Mercado Pago desconectada')
    },
    onError: (err: Error) => toast('error', err.message),
  })

  if (isLoading) return <div className="py-8 text-center text-text-muted text-sm">Carregando…</div>

  const isConnected = connection?.status === 'connected'

  return (
    <div className="space-y-4 max-w-2xl">
      {!isConnected ? (
        <div className="card p-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary-50 dark:bg-white/5 text-primary">
              <CreditCard size={20} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Conectar Mercado Pago</h3>
              <p className="text-xs text-text-muted mt-1">
                Conecte a conta do Mercado Pago da sua empresa para receber os pagamentos do Catálogo Online
                direto na sua conta — Pix e cartão, sem passar por nenhuma conta intermediária.
              </p>
              {connection?.status === 'error' && connection.last_error && (
                <p className="text-xs text-error mt-2 flex items-center gap-1">
                  <AlertTriangle size={12} /> {connection.last_error}
                </p>
              )}
              {connection?.status === 'disconnected' && (
                <p className="text-xs text-text-muted mt-2">Sua conta já esteve conectada e foi desconectada.</p>
              )}
              <a
                href="/api/mercadopago/oauth/connect"
                className="btn-primary mt-3 inline-flex items-center gap-2"
              >
                <ExternalLink size={15} />
                Conectar conta do Mercado Pago
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-success-light text-success-dark">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                  Conectado{connection?.mp_nickname ? `: ${connection.mp_nickname}` : ''}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Os pagamentos do Catálogo Online caem direto nesta conta do Mercado Pago.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="btn-secondary text-xs flex items-center gap-1.5 whitespace-nowrap"
            >
              {disconnectMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Unplug size={13} />}
              Desconectar
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <ToggleRow
              label="Pix"
              checked={connection!.pix_enabled}
              onChange={v => updateMutation.mutate({ pix_enabled: v })}
            />
            <ToggleRow
              label="Cartão"
              checked={connection!.card_enabled}
              onChange={v => updateMutation.mutate({ card_enabled: v })}
            />
          </div>

          <div>
            <label className="text-xs text-text-muted mb-1 block">Parcelamento padrão no cartão</label>
            <select
              className="input w-40"
              value={connection!.installments_default}
              onChange={e => updateMutation.mutate({ installments_default: Number(e.target.value) })}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}x</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-text-muted mb-1.5 block">Taxa do Mercado Pago</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateMutation.mutate({ fee_absorption: 'pass_to_customer' })}
                className={clsx(
                  'px-3 py-2 rounded-lg text-sm font-medium border',
                  connection!.fee_absorption === 'pass_to_customer'
                    ? 'bg-primary text-white border-primary'
                    : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400'
                )}
              >
                Repassar ao cliente
              </button>
              <button
                type="button"
                onClick={() => updateMutation.mutate({ fee_absorption: 'absorb' })}
                className={clsx(
                  'px-3 py-2 rounded-lg text-sm font-medium border',
                  connection!.fee_absorption === 'absorb'
                    ? 'bg-primary text-white border-primary'
                    : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400'
                )}
              >
                Absorver a taxa
              </button>
            </div>

            {(feeRules?.length ?? 0) > 0 && (
              <div className="mt-3 rounded-xl border border-border dark:border-border-dark overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-surface dark:bg-white/5 text-text-muted">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium">Meio de pagamento</th>
                      <th className="text-right px-3 py-1.5 font-medium">Taxa estimada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border dark:divide-border-dark">
                    {feeRules!.map((rule, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-1.5 text-text-secondary dark:text-stone-300">
                          {PAYMENT_METHOD_LABELS[rule.payment_method] ?? rule.payment_method}
                          {rule.installments_max > 1 ? ` (${rule.installments_min}–${rule.installments_max}x)` : ''}
                        </td>
                        <td className="px-3 py-1.5 text-right text-text-primary dark:text-stone-100 font-medium">
                          {rule.fee_percent}% {rule.fee_fixed > 0 ? `+ ${formatCurrency(rule.fee_fixed)}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-3 py-1.5 text-[11px] text-text-muted bg-surface dark:bg-white/5 border-t border-border dark:border-border-dark">
                  Estimativa — confira contra sua conta MP (Mercado Pago → Seu negócio → Configurações → Taxas).
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={clsx(
        'flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-colors',
        checked
          ? 'bg-success-light text-success-dark border-success-light'
          : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400'
      )}
    >
      {label}
      <span className={clsx('w-9 h-5 rounded-full relative transition-colors', checked ? 'bg-success' : 'bg-stone-300 dark:bg-stone-600')}>
        <span className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
      </span>
    </button>
  )
}
