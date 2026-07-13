'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { clsx } from 'clsx'
import { X, Landmark } from 'lucide-react'
import { FinanceFilterSelect, type FinanceFilterOption } from './FinanceFilterSelect'
import type { FinanceFilters } from '@/app/(dashboard)/financeiro/useFinanceFilters'

interface Props {
  open:       boolean
  onClose:    () => void
  filters:    FinanceFilters
  setFilters: (patch: Partial<FinanceFilters>) => void
  onResetAdvanced: () => void
  categoryOptions:      FinanceFilterOption[]
  statusOptions:        FinanceFilterOption[]
  paymentMethodOptions: FinanceFilterOption[]
}

/**
 * Painel de filtros avançados — nasce pronto para receber novos filtros no
 * futuro: basta adicionar mais um bloco aqui e um campo em FinanceFilters,
 * sem tocar em FinanceToolbar/FinanceQuickFilters.
 */
export function FinanceAdvancedFilters({
  open, onClose, filters, setFilters, onResetAdvanced,
  categoryOptions, statusOptions, paymentMethodOptions,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.1 }}
            className="absolute inset-y-0 right-0 w-full sm:w-[380px] bg-white dark:bg-surface-dark shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border dark:border-border-dark flex-shrink-0">
              <p className="text-sm font-bold text-text-primary dark:text-stone-100">Filtros avançados</p>
              <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary dark:hover:text-stone-300 hover:bg-primary-50 dark:hover:bg-white/5 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <FinanceFilterSelect
                label="Categoria"
                value={filters.category}
                options={categoryOptions}
                onChange={category => setFilters({ category })}
                placeholder="Todas as categorias"
                fullWidth
              />

              <FinanceFilterSelect
                label="Status"
                value={filters.status}
                options={statusOptions}
                onChange={status => setFilters({ status })}
                placeholder="Todos os status"
                fullWidth
              />

              <FinanceFilterSelect
                label="Forma de pagamento"
                value={filters.paymentMethod}
                options={paymentMethodOptions}
                onChange={paymentMethod => setFilters({ paymentMethod })}
                placeholder="Todas as formas"
                fullWidth
              />

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted dark:text-stone-500 mb-1">Cliente</label>
                <input
                  className="input text-sm w-full"
                  placeholder="Nome do cliente"
                  value={filters.client}
                  onChange={e => setFilters({ client: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted dark:text-stone-500 mb-1">Valor</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number" inputMode="decimal" className="input text-sm w-full" placeholder="Mínimo"
                    value={filters.amountMin} onChange={e => setFilters({ amountMin: e.target.value })}
                  />
                  <input
                    type="number" inputMode="decimal" className="input text-sm w-full" placeholder="Máximo"
                    value={filters.amountMax} onChange={e => setFilters({ amountMax: e.target.value })}
                  />
                </div>
              </div>

              <label className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border dark:border-border-dark cursor-pointer hover:border-primary/40 transition-colors">
                <span className="text-sm text-text-primary dark:text-stone-200">Somente parcelados</span>
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-primary"
                  checked={filters.installmentOnly}
                  onChange={e => setFilters({ installmentOnly: e.target.checked })}
                />
              </label>

              {/* Preparado para o futuro: filtro de conta bancária ainda não existe no modelo de dados */}
              <div className={clsx('opacity-50 pointer-events-none')}>
                <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted dark:text-stone-500 mb-1">
                  <Landmark size={11} /> Conta bancária
                  <span className="ml-1 normal-case font-medium px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-[9px]">Em breve</span>
                </label>
                <select disabled className="input text-sm w-full">
                  <option>Todas as contas</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-border dark:border-border-dark flex-shrink-0">
              <button onClick={onResetAdvanced} className="btn-secondary flex-1 text-sm">Limpar</button>
              <button onClick={onClose} className="btn-primary flex-1 text-sm">Aplicar</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
