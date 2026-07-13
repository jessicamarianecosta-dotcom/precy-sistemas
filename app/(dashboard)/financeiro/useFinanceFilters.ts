'use client'

import { useMemo, useState } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export type Period = 'all' | 'today' | 'week' | 'month' | 'last_month' | 'next_month' | 'custom'
export type TypeFilter = 'all' | 'income' | 'expense'

export interface FinanceFilters {
  search:           string
  period:           Period
  customStart:      string
  customEnd:        string
  typeFilter:       TypeFilter
  costCenterFilter: string   // 'all' | costCenterId
  supplierFilter:   string   // 'all' | 'id:<id>' | 'name:<nome>'
  category:         string   // 'all' | valor de ALL_CATS
  status:           string   // 'all' | valor de STATUS_INCOME/STATUS_EXPENSE
  paymentMethod:    string   // 'all' | PaymentMethod
  client:           string   // busca livre por nome do cliente
  amountMin:        string
  amountMax:        string
  installmentOnly:  boolean
}

const DEFAULT_FILTERS: FinanceFilters = {
  search:           '',
  period:           'month',
  customStart:      format(startOfMonth(new Date()), 'yyyy-MM-dd'),
  customEnd:        format(endOfMonth(new Date()),   'yyyy-MM-dd'),
  typeFilter:       'all',
  costCenterFilter: 'all',
  supplierFilter:   'all',
  category:         'all',
  status:           'all',
  paymentMethod:    'all',
  client:           '',
  amountMin:        '',
  amountMax:        '',
  installmentOnly:  false,
}

/**
 * Estado único de filtros do Financeiro. Qualquer filtro novo entra aqui e em
 * FinanceAdvancedFilters — nenhum outro componente da toolbar precisa mudar.
 */
export function useFinanceFilters() {
  const [filters, setFiltersState] = useState<FinanceFilters>(DEFAULT_FILTERS)

  function setFilters(patch: Partial<FinanceFilters>) {
    setFiltersState(prev => ({ ...prev, ...patch }))
  }

  function resetFilters() {
    setFiltersState(DEFAULT_FILTERS)
  }

  /** Limpa só os campos do painel de Filtros avançados, preservando período/tipo/busca/centro/fornecedor. */
  function resetAdvancedFilters() {
    setFiltersState(prev => ({
      ...prev,
      category:        DEFAULT_FILTERS.category,
      status:          DEFAULT_FILTERS.status,
      paymentMethod:   DEFAULT_FILTERS.paymentMethod,
      client:          DEFAULT_FILTERS.client,
      amountMin:       DEFAULT_FILTERS.amountMin,
      amountMax:       DEFAULT_FILTERS.amountMax,
      installmentOnly: DEFAULT_FILTERS.installmentOnly,
    }))
  }

  const advancedActiveCount = useMemo(() => {
    let n = 0
    if (filters.category !== 'all')       n++
    if (filters.status !== 'all')         n++
    if (filters.paymentMethod !== 'all')  n++
    if (filters.client.trim() !== '')     n++
    if (filters.amountMin !== '')         n++
    if (filters.amountMax !== '')         n++
    if (filters.installmentOnly)          n++
    return n
  }, [filters])

  const isAnyFilterActive = useMemo(() => (
    filters.search.trim() !== '' ||
    filters.period !== DEFAULT_FILTERS.period ||
    filters.typeFilter !== 'all' ||
    filters.costCenterFilter !== 'all' ||
    filters.supplierFilter !== 'all' ||
    advancedActiveCount > 0
  ), [filters, advancedActiveCount])

  return { filters, setFilters, resetFilters, resetAdvancedFilters, isAnyFilterActive, advancedActiveCount }
}
