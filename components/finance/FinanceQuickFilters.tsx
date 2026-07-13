'use client'

import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { FinancePeriodSelector } from './FinancePeriodSelector'
import { FinanceFilterSelect, type FinanceFilterOption, type FinanceFilterGroup } from './FinanceFilterSelect'
import type { FinanceFilters } from '@/app/(dashboard)/financeiro/useFinanceFilters'

interface TypeCounts { income: number; expense: number }

interface TypeToggleProps {
  value:    FinanceFilters['typeFilter']
  onChange: (v: FinanceFilters['typeFilter']) => void
  counts:   TypeCounts
  fullWidth?: boolean
}

/** Toggle Todos/Receitas/Despesas com contador e pílula deslizante — reutilizado no layout mobile. */
export function FinanceTypeToggle({ value, onChange, counts, fullWidth }: TypeToggleProps) {
  const options: { value: FinanceFilters['typeFilter']; label: string }[] = [
    { value: 'all',     label: 'Todos' },
    { value: 'income',  label: `Receitas (${counts.income})` },
    { value: 'expense', label: `Despesas (${counts.expense})` },
  ]
  return (
    <div className={clsx('flex items-center gap-1 p-1 rounded-xl bg-primary-50 dark:bg-white/[0.04] flex-shrink-0', fullWidth && 'w-full')}>
      {options.map(opt => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={clsx('relative px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors duration-200', fullWidth && 'flex-1')}
          >
            {active && (
              <motion.span
                layoutId="finance-type-pill"
                className="absolute inset-0 bg-white dark:bg-surface-dark rounded-lg shadow-sm"
                transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
              />
            )}
            <span className={clsx('relative', active ? 'text-primary' : 'text-text-muted dark:text-stone-500 hover:text-text-primary')}>
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

interface Props {
  filters:     FinanceFilters
  setFilters:  (patch: Partial<FinanceFilters>) => void
  costCenterOptions: FinanceFilterOption[]
  supplierGroups:    FinanceFilterGroup[]
  typeCounts:  TypeCounts
}

/** Linha 2 do desktop: período + tipo (com contador) + centro de custo + fornecedor. */
export function FinanceQuickFilters({ filters, setFilters, costCenterOptions, supplierGroups, typeCounts }: Props) {
  return (
    <>
      <FinancePeriodSelector
        period={filters.period}
        customStart={filters.customStart}
        customEnd={filters.customEnd}
        onChange={period => setFilters({ period })}
        onCustomRange={(customStart, customEnd) => setFilters({ customStart, customEnd })}
      />

      <FinanceTypeToggle
        value={filters.typeFilter}
        onChange={typeFilter => setFilters({ typeFilter })}
        counts={typeCounts}
      />

      <FinanceFilterSelect
        value={filters.costCenterFilter}
        options={costCenterOptions}
        onChange={costCenterFilter => setFilters({ costCenterFilter })}
        placeholder="Todos os centros"
      />

      <FinanceFilterSelect
        value={filters.supplierFilter}
        groups={supplierGroups}
        onChange={supplierFilter => setFilters({ supplierFilter })}
        placeholder="Todos os fornecedores"
      />
    </>
  )
}
