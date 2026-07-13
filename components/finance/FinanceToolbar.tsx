'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { Plus, SlidersHorizontal, X } from 'lucide-react'
import { FinanceSearch } from './FinanceSearch'
import { FinancePeriodSelector } from './FinancePeriodSelector'
import { FinanceFilterSelect, type FinanceFilterOption, type FinanceFilterGroup } from './FinanceFilterSelect'
import { FinanceQuickFilters, FinanceTypeToggle } from './FinanceQuickFilters'
import { FinanceAdvancedFilters } from './FinanceAdvancedFilters'
import type { FinanceFilters } from '@/app/(dashboard)/financeiro/useFinanceFilters'

interface Props {
  filters:      FinanceFilters
  setFilters:   (patch: Partial<FinanceFilters>) => void
  resetFilters: () => void
  resetAdvancedFilters: () => void
  isAnyFilterActive:  boolean
  advancedActiveCount: number
  costCenterOptions: FinanceFilterOption[]
  supplierGroups:    FinanceFilterGroup[]
  categoryOptions:      FinanceFilterOption[]
  statusOptions:        FinanceFilterOption[]
  paymentMethodOptions: FinanceFilterOption[]
  typeCounts: { income: number; expense: number }
  onNewTransaction: () => void
}

/**
 * Barra de filtros do Financeiro — 2 linhas no desktop/tablet (com wrap
 * automático), 4 linhas empilhadas no mobile. Todo filtro novo entra em
 * FinanceFilters + FinanceAdvancedFilters, sem precisar tocar este layout.
 */
export function FinanceToolbar({
  filters, setFilters, resetFilters, resetAdvancedFilters,
  isAnyFilterActive, advancedActiveCount,
  costCenterOptions, supplierGroups, categoryOptions, statusOptions, paymentMethodOptions,
  typeCounts, onNewTransaction,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  return (
    <div className="space-y-3">
      {/* ── Linha 1: busca + novo lançamento (todos os breakpoints) ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <FinanceSearch value={filters.search} onChange={search => setFilters({ search })} />
        <button onClick={onNewTransaction} className="btn-primary flex items-center justify-center gap-1.5 text-sm px-4 flex-shrink-0 w-full sm:w-auto">
          <Plus size={15} /> Novo lançamento
        </button>
      </div>

      {/* ── Linha 2 (sm e acima): período + tipo + centro de custo + fornecedor + avançados ── */}
      <div className="hidden sm:flex items-center gap-3 flex-wrap">
        <FinanceQuickFilters
          filters={filters}
          setFilters={setFilters}
          costCenterOptions={costCenterOptions}
          supplierGroups={supplierGroups}
          typeCounts={typeCounts}
        />
        <AdvancedFilterButton count={advancedActiveCount} onClick={() => setAdvancedOpen(true)} />
        {isAnyFilterActive && <ClearFiltersButton onClick={resetFilters} />}
      </div>

      {/* ── Mobile (< sm): período scroll + centro/fornecedor/tipo empilhados ── */}
      <div className="sm:hidden space-y-2">
        <FinancePeriodSelector
          period={filters.period}
          customStart={filters.customStart}
          customEnd={filters.customEnd}
          onChange={period => setFilters({ period })}
          onCustomRange={(customStart, customEnd) => setFilters({ customStart, customEnd })}
          scroll
        />

        <div className="grid grid-cols-1 gap-2">
          <FinanceFilterSelect
            value={filters.costCenterFilter}
            options={costCenterOptions}
            onChange={costCenterFilter => setFilters({ costCenterFilter })}
            placeholder="Todos os centros"
            fullWidth
          />
          <FinanceFilterSelect
            value={filters.supplierFilter}
            groups={supplierGroups}
            onChange={supplierFilter => setFilters({ supplierFilter })}
            placeholder="Todos os fornecedores"
            fullWidth
          />
          <FinanceTypeToggle
            value={filters.typeFilter}
            onChange={typeFilter => setFilters({ typeFilter })}
            counts={typeCounts}
            fullWidth
          />
        </div>

        <div className="flex items-stretch gap-2">
          <AdvancedFilterButton count={advancedActiveCount} onClick={() => setAdvancedOpen(true)} fullWidth />
          {isAnyFilterActive && <ClearFiltersButton onClick={resetFilters} fullWidth />}
        </div>
      </div>

      <FinanceAdvancedFilters
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        filters={filters}
        setFilters={setFilters}
        onResetAdvanced={resetAdvancedFilters}
        categoryOptions={categoryOptions}
        statusOptions={statusOptions}
        paymentMethodOptions={paymentMethodOptions}
      />
    </div>
  )
}

function AdvancedFilterButton({ count, onClick, fullWidth }: { count: number; onClick: () => void; fullWidth?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'relative flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-border dark:border-border-dark text-text-secondary dark:text-stone-400 hover:border-primary/40 hover:text-primary transition-colors whitespace-nowrap flex-shrink-0',
        fullWidth && 'flex-1'
      )}
    >
      <SlidersHorizontal size={13} />
      Filtros avançados
      {count > 0 && (
        <span className="ml-0.5 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  )
}

function ClearFiltersButton({ onClick, fullWidth }: { onClick: () => void; fullWidth?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl text-error dark:text-red-400 hover:bg-error-light dark:hover:bg-error/10 transition-colors whitespace-nowrap flex-shrink-0',
        fullWidth && 'flex-1'
      )}
    >
      <X size={13} />
      Limpar filtros
    </button>
  )
}
