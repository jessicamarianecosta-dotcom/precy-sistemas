'use client'

import { CreditCard, Info } from 'lucide-react'
import { format } from 'date-fns'
import {
  ORDER_PAYMENT_METHODS, IMMEDIATE_CAPABLE_METHODS, CARD_BRANDS,
  buildPaymentScheduleDraft, type OrderPaymentMethod,
} from '@/lib/orders/paymentSchedule'
import { formatCurrency } from '@/lib/utils/format'

export interface OrderFinanceFormState {
  receivedNow:            boolean
  receivedDate:            string
  dueDate:                  string
  cardBrand:                string
  cardInstallments:         number
  cardFeePercent:           number
  cardFirstReceiptDate:     string
  boletoNumber:             string
  notes:                    string
  crediarioInstallments:    number
  crediarioFirstDueDate:    string
}

const today = () => format(new Date(), 'yyyy-MM-dd')

export const DEFAULT_ORDER_FINANCE_FORM: OrderFinanceFormState = {
  // Pedido nasce SEM recebimento. O dinheiro só entra quando o usuário
  // registra manualmente em "Registrar Recebimento" (ou marca "Recebido agora? Sim").
  receivedNow:         false,
  receivedDate:         today(),
  dueDate:               today(),
  cardBrand:             '',
  cardInstallments:      1,
  cardFeePercent:        0,
  cardFirstReceiptDate:  today(),
  boletoNumber:          '',
  notes:                 '',
  crediarioInstallments: 3,
  crediarioFirstDueDate: today(),
}

const inputClass = 'input'
const labelClass = 'block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5'

export function OrderFinanceSection({
  paymentMethod, onPaymentMethodChange, value, onChange, total, locked,
}: {
  paymentMethod:            OrderPaymentMethod
  onPaymentMethodChange:    (method: OrderPaymentMethod) => void
  value:                     OrderFinanceFormState
  onChange:                  (patch: Partial<OrderFinanceFormState>) => void
  total:                     number
  /** Pedido já tem recebimento registrado — plano de pagamento não é mais gerado a partir daqui. */
  locked?:                   boolean
}) {
  const preview = locked ? [] : buildPaymentScheduleDraft({
    payment_method: paymentMethod,
    total,
    receivedNow:    value.receivedNow,
    receivedDate:   value.receivedDate,
    dueDate:        value.dueDate,
    cardBrand:      value.cardBrand,
    cardInstallments: value.cardInstallments,
    cardFeePercent: value.cardFeePercent,
    cardFirstReceiptDate: value.cardFirstReceiptDate,
    boletoNumber:   value.boletoNumber,
    notes:          value.notes,
    crediarioInstallments: value.crediarioInstallments,
    crediarioFirstDueDate: value.crediarioFirstDueDate,
  })

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
        <CreditCard size={12} /> Financeiro
      </h3>

      {locked && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-info-light dark:bg-info/10 border border-info/20 text-xs text-info-dark dark:text-info">
          <Info size={14} className="flex-shrink-0 mt-0.5" />
          Este pedido já tem recebimento registrado. Para alterar forma de pagamento ou vencimentos,
          use o card Financeiro dentro do pedido — a edição aqui não altera as parcelas existentes.
        </div>
      )}

      <div>
        <label className={labelClass}>Forma de pagamento</label>
        <select
          className={inputClass}
          value={paymentMethod || ''}
          onChange={e => onPaymentMethodChange(e.target.value as OrderPaymentMethod)}
          disabled={locked}
        >
          <option value="">Não definido</option>
          {ORDER_PAYMENT_METHODS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {!locked && paymentMethod && IMMEDIATE_CAPABLE_METHODS.includes(paymentMethod) && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Recebido agora?</label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={value.receivedNow} onChange={() => onChange({ receivedNow: true })} />
                Sim
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={!value.receivedNow} onChange={() => onChange({ receivedNow: false })} />
                Não
              </label>
            </div>
          </div>

          {value.receivedNow ? (
            <div>
              <label className={labelClass}>Data do recebimento</label>
              <input type="date" className={inputClass} value={value.receivedDate}
                onChange={e => onChange({ receivedDate: e.target.value })} />
            </div>
          ) : (
            <div>
              <label className={labelClass}>Vencimento</label>
              <input type="date" className={inputClass} value={value.dueDate}
                onChange={e => onChange({ dueDate: e.target.value })} />
            </div>
          )}
        </div>
      )}

      {!locked && paymentMethod === 'cartao_credito' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Bandeira</label>
            <select className={inputClass} value={value.cardBrand} onChange={e => onChange({ cardBrand: e.target.value })}>
              <option value="">Selecione</option>
              {CARD_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Parcelas</label>
            <select className={inputClass} value={value.cardInstallments}
              onChange={e => onChange({ cardInstallments: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}x</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Taxa da maquininha (%)</label>
            <input type="number" step="0.01" min={0} max={100} className={inputClass}
              value={value.cardFeePercent} onChange={e => onChange({ cardFeePercent: Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelClass}>Data prevista de recebimento</label>
            <input type="date" className={inputClass} value={value.cardFirstReceiptDate}
              onChange={e => onChange({ cardFirstReceiptDate: e.target.value })} />
          </div>
        </div>
      )}

      {!locked && paymentMethod === 'boleto' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Data de vencimento</label>
            <input type="date" className={inputClass} value={value.dueDate}
              onChange={e => onChange({ dueDate: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Número do boleto (opcional)</label>
            <input type="text" className={inputClass} value={value.boletoNumber}
              onChange={e => onChange({ boletoNumber: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Observações</label>
            <input type="text" className={inputClass} value={value.notes}
              onChange={e => onChange({ notes: e.target.value })} />
          </div>
        </div>
      )}

      {!locked && paymentMethod === 'crediario' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Quantidade de parcelas</label>
            <select className={inputClass} value={value.crediarioInstallments}
              onChange={e => onChange({ crediarioInstallments: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}x</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Primeiro vencimento</label>
            <input type="date" className={inputClass} value={value.crediarioFirstDueDate}
              onChange={e => onChange({ crediarioFirstDueDate: e.target.value })} />
          </div>
          {value.crediarioInstallments > 0 && total > 0 && (
            <p className="col-span-2 text-xs text-text-muted dark:text-stone-400">
              Valor por parcela: {formatCurrency(total / value.crediarioInstallments)}
            </p>
          )}
        </div>
      )}

      {!locked && preview.length > 0 && (
        <div className="rounded-xl border border-border dark:border-border-dark divide-y divide-border dark:divide-border-dark overflow-hidden">
          {preview.map(row => (
            <div key={row.installment_number} className="flex items-center justify-between px-3.5 py-2 text-xs">
              <span className="text-text-secondary dark:text-stone-300">
                Parcela {row.installment_number}/{row.installment_count} · {format(new Date(row.due_date + 'T00:00:00'), 'dd/MM/yyyy')}
              </span>
              <span className="font-semibold text-text-primary dark:text-stone-100">{formatCurrency(row.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
