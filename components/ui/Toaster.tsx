'use client'

import {
  useState, useEffect, createContext,
  useContext, useCallback, useRef,
} from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'
import { clsx } from 'clsx'

/* ─────────── Types ─────────── */
export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id:       string
  type:     ToastType
  message:  string
  duration: number
}

interface ToastContextType {
  toast: (type: ToastType, message: string, duration?: number) => void
}

/* ─────────── Context ─────────── */
const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}

/* ─────────── Config ─────────── */
const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertCircle,
  info:    Info,
}
const STYLES = {
  success: 'bg-success-light border-success/25 text-success-dark dark:bg-success/10',
  error:   'bg-error-light border-error/25 text-error-dark dark:bg-error/10',
  warning: 'bg-warning-light border-warning/25 text-warning-dark dark:bg-warning/10',
  info:    'bg-info-light border-info/25 text-info-dark dark:bg-info/10',
}
const ICON_COLORS = {
  success: 'text-success',
  error:   'text-error',
  warning: 'text-warning',
  info:    'text-info',
}

/* ─────────── Provider (wraps children) ─────────── */
export function Toaster({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Record<string, NodeJS.Timeout>>({})

  const remove = useCallback((id: string) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setToasts(prev => [...prev.slice(-4), { id, type, message, duration }])
    timers.current[id] = setTimeout(() => remove(id), duration)
  }, [remove])

  useEffect(() => {
    return () => Object.values(timers.current).forEach(clearTimeout)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Display */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-4 z-[200] flex flex-col gap-2 max-w-xs w-full pointer-events-none"
      >
        {toasts.map(t => {
          const Icon = ICONS[t.type]
          return (
            <div
              key={t.id}
              className={clsx(
                'flex items-start gap-3 p-4 rounded-2xl border shadow-modal pointer-events-auto',
                'animate-scaleIn',
                STYLES[t.type]
              )}
            >
              <Icon size={16} className={clsx('flex-shrink-0 mt-0.5', ICON_COLORS[t.type])} />
              <span className="text-sm font-medium flex-1 leading-snug">{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
