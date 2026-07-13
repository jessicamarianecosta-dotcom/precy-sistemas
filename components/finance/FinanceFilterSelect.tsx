'use client'

import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'

export interface FinanceFilterOption {
  value: string
  label: string
}

export interface FinanceFilterGroup {
  label:   string
  options: FinanceFilterOption[]
}

interface Props {
  label?:       string
  icon?:        LucideIcon
  value:        string
  options?:     FinanceFilterOption[]
  groups?:      FinanceFilterGroup[]
  onChange:     (value: string) => void
  placeholder?: string
  className?:   string
  fullWidth?:   boolean
}

/**
 * Select genérico reutilizável para qualquer filtro do Financeiro (Centro de
 * Custo, Fornecedor, Categoria, Status, Forma de Pagamento, e qualquer filtro
 * novo no futuro) — um único componente/estilo em vez de <select> ad hoc.
 */
export function FinanceFilterSelect({ label, icon: Icon, value, options, groups, onChange, placeholder, className, fullWidth }: Props) {
  return (
    <div className={clsx(fullWidth && 'w-full', className)}>
      {label && (
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted dark:text-stone-500 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && <Icon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />}
        <select
          className={clsx(
            'input text-xs py-2 flex-shrink-0',
            Icon && 'pl-7',
            fullWidth ? 'w-full' : 'w-auto max-w-[160px]'
          )}
          value={value}
          onChange={e => onChange(e.target.value)}
        >
          {placeholder && <option value="all">{placeholder}</option>}
          {options?.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
          {groups?.map(group => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  )
}
