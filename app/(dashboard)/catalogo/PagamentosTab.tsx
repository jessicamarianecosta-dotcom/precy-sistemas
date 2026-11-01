'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/Toaster'
import { useCompanyId } from '@/hooks/useCompanyId'
import { Loader2, CreditCard, QrCode, Link2, Unlink, CheckCircle2, AlertTriangle, Info } from 'lucide-react'

interface StatusResponse {
  account: { connected: boolean; providerUserId?: string | null; liveMode?: boolean; connectedAt?: string | null; lastError?: string | null }
  settings: { pix_enabled: boolean; card_enabled: boolean; card_max_installments: number; surcharge_mode: 'pass_to_customer' | 'absorb' }
  feeRules: Array<{ payment_method: string; installments: number; fee_percent: number; fee_fixed: number; company_id: string | null }>
}

/**
 * Configurações > Loja online > Pagamentos — conexão da conta Mercado Pago
 * da loja e as regras de Pix/cartão/parcelamento daquela loja (nunca
 * configuração global: tudo aqui é por company_id).
 */
export function PagamentosTab() {
  const { companyId } = useCompanyId()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('mp_connect')
    if (result === 'success') toast('success', 'Conta Mercado Pago conectada com sucesso!')
    if (result === 'error') toast('error', params.get('mp_message') || 'Não foi possível concluir a conexão.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data, isLoading } = useQuery<StatusResponse>({
    queryKey: ['payment-status', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const res = await fetch('/api/loja/pagamentos/mercadopago/status')
      if (!res.ok) throw new Error('Erro ao consultar pagamentos')
      return res.json()
    },
  })

  const configMutation = useMutation({
    mutationFn: async (patch: Partial<StatusResponse['settings']>) => {
      const merged = { ...data!.settings, ...patch }
      const res = await fetch('/api/loja/pagamentos/mercadopago/configurar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pixEnabled: merged.pix_enabled,
          cardEnabled: merged.card_enabled,
          cardMaxInstallments: merged.card_max_installments,
          surchargeMode: merged.surcharge_mode,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-status', companyId] })
      toast('success', 'Configuração de pagamento atualizada!')
    },
    onError: (err: Error) => toast('error', err.message),
  })

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/loja/pagamentos/mercadopago/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao desconectar')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-status', companyId] })
      toast('success', 'Conta Mercado Pago desconectada.')
    },
    onError: (err: Error) => toast('error', err.message),
  })

  async function connect() {
    setConnecting(true)
    try {
      const res = await fetch('/api/loja/pagamentos/mercadopago/connect')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao conectar')
      window.location.href = json.url
    } catch (err: any) {
      toast('error', err.message)
      setConnecting(false)
    }
  }

  if (isLoading || !data) return <div className="py-8 text-center text-text-muted text-sm">Carregando…</div>

  const { account, settings } = data

  return (
    <div className="space-y-5 max-w-3xl">
      {/* ── Conexão da conta ── */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Conta Mercado Pago</h3>
        </div>

        {account.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-success text-sm">
              <CheckCircle2 size={15} />
              <span>Conta conectada{account.providerUserId ? ` (ID ${account.providerUserId})` : ''}</span>
              {account.liveMode === false && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning-light text-warning-dark font-semibold">TESTE</span>
              )}
            </div>
            <p className="text-xs text-text-muted">
              Os recebimentos caem direto na própria conta Mercado Pago desta loja — o Precy não retém nem intermedia o dinheiro.
            </p>
            <button
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              {disconnectMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />}
              Desconectar conta
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary dark:text-stone-400">
              Conecte a conta Mercado Pago da loja para receber pagamentos de Pix e cartão diretamente na sua conta.
            </p>
            {account.lastError && (
              <p className="text-xs text-error flex items-start gap-1.5"><AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />{account.lastError}</p>
            )}
            <button onClick={connect} disabled={connecting} className="btn-primary text-sm flex items-center gap-2">
              {connecting ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
              Conectar conta Mercado Pago
            </button>
          </div>
        )}
      </div>

      {/* ── Formas de pagamento ── */}
      <div className="card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Formas de pagamento</h3>

        <label className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <QrCode size={15} className="text-text-muted" />
            <span className="text-sm text-text-secondary dark:text-stone-300">Pix</span>
          </div>
          <input
            type="checkbox"
            checked={settings.pix_enabled}
            disabled={!account.connected || configMutation.isPending}
            onChange={e => configMutation.mutate({ pix_enabled: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />
        </label>

        <label className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CreditCard size={15} className="text-text-muted" />
            <span className="text-sm text-text-secondary dark:text-stone-300">Cartão de crédito</span>
          </div>
          <input
            type="checkbox"
            checked={settings.card_enabled}
            disabled={!account.connected || configMutation.isPending}
            onChange={e => configMutation.mutate({ card_enabled: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />
        </label>

        {settings.card_enabled && (
          <div className="pl-6 space-y-3 border-l-2 border-border dark:border-border-dark">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Parcelamento máximo</label>
              <div className="flex gap-2">
                {[1, 2, 3].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => configMutation.mutate({ card_max_installments: n })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                      settings.card_max_installments === n
                        ? 'bg-primary text-white border-primary'
                        : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400'
                    }`}
                  >
                    até {n}x
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-text-muted mb-1 block">Custo do cartão</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => configMutation.mutate({ surcharge_mode: 'pass_to_customer' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    settings.surcharge_mode === 'pass_to_customer'
                      ? 'bg-primary text-white border-primary'
                      : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400'
                  }`}
                >
                  Repassar ao cliente
                </button>
                <button
                  type="button"
                  onClick={() => configMutation.mutate({ surcharge_mode: 'absorb' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    settings.surcharge_mode === 'absorb'
                      ? 'bg-primary text-white border-primary'
                      : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400'
                  }`}
                >
                  Absorver o custo
                </button>
              </div>
              <p className="text-xs text-text-muted mt-1.5 flex items-start gap-1.5">
                <Info size={12} className="mt-0.5 flex-shrink-0" />
                {settings.surcharge_mode === 'pass_to_customer'
                  ? 'O preço cadastrado é o preço no Pix — no cartão, o valor aumenta conforme o parcelamento para cobrir a taxa.'
                  : 'O cliente paga o mesmo valor em qualquer forma de pagamento — a taxa do cartão sai do seu recebimento.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Taxas configuradas ── */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-3">Taxas configuradas</h3>
        <div className="space-y-1.5">
          {data.feeRules.map(rule => (
            <div key={`${rule.payment_method}-${rule.installments}`} className="flex items-center justify-between text-sm py-1.5 border-b border-border dark:border-border-dark last:border-0">
              <span className="text-text-secondary dark:text-stone-300">
                {rule.payment_method === 'pix' ? 'Pix' : `Cartão ${rule.installments}x`}
              </span>
              <span className="font-medium text-text-primary dark:text-stone-100">
                {(rule.fee_percent * 100).toFixed(2)}% {rule.fee_fixed > 0 && `+ R$ ${rule.fee_fixed.toFixed(2)}`}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted mt-3">
          Taxas de referência — confirme as condições reais exibidas na conta Mercado Pago conectada
          (Mercado Pago → Seu negócio → Taxas e prazos) e informe ao suporte Precy+ se forem diferentes.
        </p>
      </div>
    </div>
  )
}
