'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { Calendar, X } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, addMonths, subMonths,
  getDaysInMonth, getDay, parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Period } from '@/app/(dashboard)/financeiro/useFinanceFilters'

const QUICK_PERIODS: { value: Period; label: string }[] = [
  { value: 'today',      label: 'Hoje' },
  { value: 'week',       label: 'Semana' },
  { value: 'month',      label: 'Mês atual' },
  { value: 'next_month', label: 'Próx. mês' },
  { value: 'last_month', label: 'Mês anterior' },
]

interface Props {
  period:       Period
  customStart:  string
  customEnd:    string
  onChange:     (period: Period) => void
  onCustomRange: (start: string, end: string) => void
  /** true = chips rolam horizontalmente (mobile); false = quebram em várias linhas (desktop/tablet) */
  scroll?: boolean
}

export function FinancePeriodSelector({ period, customStart, customEnd, onChange, onCustomRange, scroll }: Props) {
  const [showCustom,  setShowCustom]  = useState(false)
  const [calViewDate, setCalViewDate] = useState(new Date())
  const [pickStep,    setPickStep]    = useState<'start' | 'end'>('start')

  return (
    <div className={clsx(
      'flex items-center gap-1 p-1 rounded-xl bg-primary-50 dark:bg-white/[0.04] flex-shrink-0',
      scroll ? 'overflow-x-auto no-scrollbar' : 'flex-wrap'
    )}>
      {QUICK_PERIODS.map(opt => {
        const active = period === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => { onChange(opt.value); setShowCustom(false) }}
            className="relative px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors duration-200"
          >
            {active && (
              <motion.span
                layoutId="finance-period-pill"
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

      {/* Personalizado */}
      <div className="relative">
        <button
          onClick={() => { onChange('custom'); setShowCustom(s => !s) }}
          className="relative px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1 whitespace-nowrap transition-colors duration-200"
        >
          {period === 'custom' && (
            <motion.span
              layoutId="finance-period-pill"
              className="absolute inset-0 bg-white dark:bg-surface-dark rounded-lg shadow-sm"
              transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
            />
          )}
          <span className={clsx('relative flex items-center gap-1', period === 'custom' ? 'text-primary' : 'text-text-muted dark:text-stone-500 hover:text-text-primary')}>
            <Calendar size={11} />
            {period === 'custom'
              ? `${customStart.split('-').reverse().slice(0, 2).join('/')} → ${customEnd.split('-').reverse().slice(0, 2).join('/')}`
              : 'Personalizado'}
          </span>
        </button>

        {showCustom && (
          <div className="fixed sm:absolute inset-x-0 sm:inset-x-auto bottom-0 sm:bottom-auto top-auto sm:top-full sm:right-0 mt-0 sm:mt-2 z-[60] sm:animate-scaleIn px-3 sm:px-0 pb-4 sm:pb-0">
            <div className="fixed inset-0 bg-black/40 sm:hidden" onClick={() => setShowCustom(false)} />
            <div className="relative bg-white dark:bg-[#1C1714] rounded-t-2xl sm:rounded-2xl border-t sm:border border-border dark:border-stone-800 shadow-[0_-8px_32px_rgba(0,0,0,0.3)] sm:shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-4 space-y-3 sm:w-[320px]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-text-primary dark:text-stone-100">Período personalizado</p>
                <button onClick={() => setShowCustom(false)}
                  className="p-1 rounded-lg text-text-muted hover:text-text-primary dark:hover:text-stone-300 hover:bg-primary-50 dark:hover:bg-white/5 transition-colors">
                  <X size={13} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'De', value: customStart, active: pickStep === 'start' },
                  { label: 'Até', value: customEnd, active: pickStep === 'end' },
                ].map(f => (
                  <button key={f.label} type="button"
                    onClick={() => setPickStep(f.label === 'De' ? 'start' : 'end')}
                    className={clsx(
                      'flex flex-col items-start px-3 py-2 rounded-xl border text-left transition-all',
                      f.active
                        ? 'border-primary bg-primary-50 dark:bg-primary/10'
                        : 'border-border dark:border-stone-700 hover:border-primary/50'
                    )}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted dark:text-stone-500">{f.label}</span>
                    <span className="text-sm font-semibold text-text-primary dark:text-stone-100 mt-0.5">
                      {f.value ? f.value.split('-').reverse().join('/') : '—'}
                    </span>
                  </button>
                ))}
              </div>

              {/* Calendário */}
              {(() => {
                const year  = calViewDate.getFullYear()
                const month = calViewDate.getMonth()
                const firstDay    = new Date(year, month, 1)
                const daysInMonth = getDaysInMonth(firstDay)
                const startWday   = getDay(firstDay)
                const today = format(new Date(), 'yyyy-MM-dd')

                const cells: (number | null)[] = [
                  ...Array(startWday).fill(null),
                  ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                ]
                while (cells.length % 7 !== 0) cells.push(null)

                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => setCalViewDate(d => subMonths(d, 1))}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-primary/10 transition-colors text-sm font-bold">
                        ‹
                      </button>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={month}
                          onChange={e => setCalViewDate(d => new Date(d.getFullYear(), Number(e.target.value), 1))}
                          className="text-xs font-bold text-text-primary dark:text-stone-100 bg-transparent border-none outline-none cursor-pointer hover:text-primary transition-colors capitalize"
                        >
                          {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i} className="bg-white dark:bg-stone-900">
                              {format(new Date(2000, i, 1), 'MMMM', { locale: ptBR })}
                            </option>
                          ))}
                        </select>
                        <select
                          value={year}
                          onChange={e => setCalViewDate(d => new Date(Number(e.target.value), d.getMonth(), 1))}
                          className="text-xs font-bold text-text-primary dark:text-stone-100 bg-transparent border-none outline-none cursor-pointer hover:text-primary transition-colors"
                        >
                          {Array.from({ length: 12 }, (_, i) => {
                            const y = new Date().getFullYear() - 2 + i
                            return <option key={y} value={y} className="bg-white dark:bg-stone-900">{y}</option>
                          })}
                        </select>
                      </div>
                      <button
                        onClick={() => setCalViewDate(d => addMonths(d, 1))}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-primary/10 transition-colors text-sm font-bold">
                        ›
                      </button>
                    </div>

                    <div className="grid grid-cols-7 mb-1">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                        <div key={i} className="text-center text-[9px] font-bold text-text-muted dark:text-stone-600 uppercase py-0.5">{d}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-px">
                      {cells.map((day, idx) => {
                        if (!day) return <div key={idx} />
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        const isStart = dateStr === customStart
                        const isEnd   = dateStr === customEnd
                        const inRange = customStart && customEnd && dateStr > customStart && dateStr < customEnd
                        const isNow   = dateStr === today
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (pickStep === 'start') {
                                const newEnd = dateStr > customEnd ? dateStr : customEnd
                                onCustomRange(dateStr, newEnd)
                                setPickStep('end')
                              } else {
                                if (dateStr < customStart) {
                                  onCustomRange(dateStr, customStart)
                                } else {
                                  onCustomRange(customStart, dateStr)
                                }
                                setPickStep('start')
                              }
                            }}
                            className={clsx(
                              'h-7 w-full rounded-lg text-[11px] font-medium transition-all',
                              isStart || isEnd
                                ? 'bg-primary text-white font-bold shadow-sm'
                                : inRange
                                  ? 'bg-primary-50 dark:bg-primary/15 text-primary'
                                  : isNow
                                    ? 'ring-1 ring-primary text-primary'
                                    : 'text-text-primary dark:text-stone-200 hover:bg-primary-50 dark:hover:bg-primary/10 hover:text-primary'
                            )}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Atalhos rápidos */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted dark:text-stone-500 uppercase tracking-wider mb-1.5">Atalhos</p>
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: 'Este mês',    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end: format(endOfMonth(new Date()), 'yyyy-MM-dd') },
                    { label: 'Próx. mês',   start: format(startOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd'), end: format(endOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd') },
                    { label: 'Mês passado', start: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'), end: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd') },
                    { label: 'Últimos 30d', start: format(subMonths(new Date(), 1), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') },
                    { label: 'Próx. 3m',    start: format(new Date(), 'yyyy-MM-dd'), end: format(endOfMonth(addMonths(new Date(), 2)), 'yyyy-MM-dd') },
                    { label: 'Este ano',    start: `${new Date().getFullYear()}-01-01`, end: `${new Date().getFullYear()}-12-31` },
                  ].map(s => (
                    <button key={s.label} type="button"
                      onClick={() => {
                        onCustomRange(s.start, s.end)
                        setCalViewDate(parseISO(s.start))
                      }}
                      className="text-[10px] font-medium px-2 py-1 rounded-lg border border-border dark:border-stone-700 text-text-muted dark:text-stone-400 hover:border-primary hover:text-primary transition-all whitespace-nowrap">
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowCustom(false); onChange('all') }}
                  className="btn-secondary flex-1 text-xs py-2">Limpar</button>
                <button onClick={() => setShowCustom(false)}
                  className="btn-primary flex-1 text-xs py-2">Aplicar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
