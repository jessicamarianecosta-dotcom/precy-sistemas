'use client'

import { Check } from 'lucide-react'
import { CHECKOUT_STEPS, CHECKOUT_STEP_LABELS, type CheckoutStep } from '@/lib/catalog/checkout/useCheckoutState'

interface StepIndicatorProps {
  currentStep: CheckoutStep
  /** Etapas que o cliente já concluiu (pode voltar e reabrir). */
  completedSteps: CheckoutStep[]
  onStepClick?: (step: CheckoutStep) => void
}

/**
 * Indicador de progresso das 4 etapas do checkout. Segue a paleta da loja
 * (var(--store-*), aplicada por StoreThemeRoot) — nunca cores fixas.
 * Compacto no celular: barra de progresso + "Etapa X de 4".
 */
export function StepIndicator({ currentStep, completedSteps, onStepClick }: StepIndicatorProps) {
  const currentIndex = CHECKOUT_STEPS.indexOf(currentStep)

  return (
    <div className="mb-5">
      {/* Desktop/tablet: círculos numerados + linha de conexão */}
      <div className="hidden sm:flex items-center">
        {CHECKOUT_STEPS.map((step, idx) => {
          const isCompleted = completedSteps.includes(step)
          const isCurrent = step === currentStep
          const clickable = !!onStepClick && (isCompleted || isCurrent)
          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(step)}
                className="flex items-center gap-2 group"
              >
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors"
                  style={
                    isCurrent
                      ? { backgroundColor: 'var(--store-primary)', color: 'var(--store-button-text)' }
                      : isCompleted
                      ? { backgroundColor: 'var(--store-accent)', color: 'var(--store-button-text)' }
                      : { backgroundColor: 'var(--store-surface)', color: 'var(--store-text-secondary)', border: '1px solid var(--store-border)' }
                  }
                >
                  {isCompleted && !isCurrent ? <Check size={14} /> : idx + 1}
                </span>
                <span
                  className="text-xs font-medium whitespace-nowrap"
                  style={{ color: isCurrent ? 'var(--store-text)' : 'var(--store-text-secondary)' }}
                >
                  {CHECKOUT_STEP_LABELS[step]}
                </span>
              </button>
              {idx < CHECKOUT_STEPS.length - 1 && (
                <div
                  className="flex-1 h-px mx-3"
                  style={{ backgroundColor: idx < currentIndex ? 'var(--store-accent)' : 'var(--store-border)' }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Celular: compacto, sem quebrar em várias linhas */}
      <div className="sm:hidden space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold" style={{ color: 'var(--store-text)' }}>
            Etapa {currentIndex + 1} de {CHECKOUT_STEPS.length} · {CHECKOUT_STEP_LABELS[currentStep]}
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--store-surface)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${((currentIndex + 1) / CHECKOUT_STEPS.length) * 100}%`,
              backgroundColor: 'var(--store-primary)',
            }}
          />
        </div>
      </div>
    </div>
  )
}
