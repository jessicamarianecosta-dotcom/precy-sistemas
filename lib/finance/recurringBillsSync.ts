import { format, isSameMonth, isSameYear, isSameWeek, differenceInCalendarDays, startOfDay } from 'date-fns'
import { nextDueFrom } from '@/lib/utils/recurring'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

export interface RecurringBillRow {
  id:             string
  name:           string
  amount:         number
  type:           'income' | 'expense' | null
  periodicity:    'weekly' | 'biweekly' | 'monthly' | 'yearly'
  next_due_date:  string
  cost_center_id: string | null
  is_active:      boolean
}

/** Trava de segurança: nunca gera mais que isso de competências atrasadas
 *  numa única sincronização, mesmo que a conta esteja parada há anos. */
const MAX_CATCH_UP_CYCLES = 36

/**
 * Uma conta recorrente "pertence" ao período de competência atual assim
 * que esse período começa — não apenas quando o dia do vencimento já
 * passou. Ex: conta mensal que vence dia 10, verificada no dia 7, já deve
 * gerar o lançamento do mês corrente (a pagar, vencimento dia 10).
 */
function isDueForCurrentPeriod(nextDueDate: Date, periodicity: string, today: Date): boolean {
  if (nextDueDate <= today) return true
  switch (periodicity) {
    case 'monthly':  return isSameMonth(nextDueDate, today) && isSameYear(nextDueDate, today)
    case 'yearly':   return isSameYear(nextDueDate, today)
    case 'weekly':   return isSameWeek(nextDueDate, today, { weekStartsOn: 0 })
    case 'biweekly': return differenceInCalendarDays(nextDueDate, today) < 14
    default:         return false
  }
}

/**
 * Fonte única de verdade para "Conta Recorrente → Instância Financeira".
 *
 * Para cada conta recorrente ativa da empresa, garante que exista um
 * lançamento real em financial_transactions para o período de competência
 * atual (e para qualquer período anterior ainda não gerado — catch-up).
 * O lançamento é uma linha real: entra no saldo, no Fluxo de Caixa, no
 * DRE, no Dashboard, nas Metas e na Projeção, exatamente como qualquer
 * outro lançamento manual — porque todos eles leem de
 * financial_transactions sem nenhum filtro especial.
 *
 * Idempotente: a chave (recurring_bill_id, date) é única no banco
 * (ver migration 072), então rodar isto várias vezes — em abas
 * diferentes, em telas diferentes, em paralelo — nunca duplica.
 */
export async function syncRecurringBills(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ generated: number }> {
  const { data: bills, error } = await (supabase.from('recurring_bills') as any)
    .select('id, name, amount, type, periodicity, next_due_date, cost_center_id, is_active')
    .eq('company_id', companyId)
    .eq('is_active', true)

  if (error || !bills?.length) return { generated: 0 }

  const today = startOfDay(new Date())
  let generated = 0

  for (const bill of bills as RecurringBillRow[]) {
    let cursor = new Date(bill.next_due_date + 'T00:00:00')
    let cycles = 0

    while (isDueForCurrentPeriod(cursor, bill.periodicity, today) && cycles < MAX_CATCH_UP_CYCLES) {
      const billType = (bill.type ?? 'expense') as 'income' | 'expense'

      const { error: upsertError, data: upserted } = await (supabase.from('financial_transactions') as any)
        .upsert(
          [{
            company_id:       companyId,
            type:              billType,
            category:          'outros',
            amount:            bill.amount,
            description:       `${bill.name} (conta recorrente)`,
            date:              format(cursor, 'yyyy-MM-dd'),
            status:            billType === 'income' ? 'pending' : 'to_pay',
            cost_center_id:    bill.cost_center_id,
            recurring_bill_id: bill.id,
          }],
          { onConflict: 'recurring_bill_id,date', ignoreDuplicates: true },
        )
        .select('id')

      if (!upsertError && upserted?.length) generated++

      cursor = nextDueFrom(cursor, bill.periodicity)
      cycles++
    }

    if (cycles > 0) {
      await (supabase.from('recurring_bills') as any)
        .update({ next_due_date: format(cursor, 'yyyy-MM-dd'), updated_at: new Date().toISOString() })
        .eq('id', bill.id)
    }
  }

  return { generated }
}
