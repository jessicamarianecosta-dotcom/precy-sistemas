'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, ImageOff, X } from 'lucide-react'

interface CoverOption {
  id: string
  value: string
  imageUrl: string | null
  allowed: boolean
}

interface Props {
  title: string
  options: CoverOption[]
  selectedId: string | null
  onSelect: (optionId: string) => void
  onClose: () => void
}

/**
 * Seletor visual de capas (ou qualquer grupo de variação chamado "Capa") —
 * grade grande, quase em tela cheia, com rolagem interna. Fecha
 * automaticamente ao escolher uma opção (ProdutoLojaPage cuida disso via
 * onSelect). Puramente apresentacional: quem decide SE este modal existe é
 * a página do produto, com base no nome do grupo (isCapaGroup).
 */
export function CoverPickerModal({ title, options, selectedId, onSelect, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div
        className="relative bg-[var(--store-bg)] text-[var(--store-text)] w-full h-[92vh] sm:h-auto sm:max-h-[88vh] sm:w-[min(880px,94vw)] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border dark:border-border-dark flex-shrink-0">
          <h2 className="text-base font-bold text-text-primary dark:text-stone-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-text-muted flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {options.map(opt => {
              const active = selectedId === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!opt.allowed}
                  title={!opt.allowed ? 'Combinação indisponível' : undefined}
                  onClick={() => opt.allowed && onSelect(opt.id)}
                  className={`relative flex flex-col rounded-2xl border-2 overflow-hidden text-left transition-colors ${
                    !opt.allowed
                      ? 'opacity-40 cursor-not-allowed border-border dark:border-border-dark'
                      : active
                      ? 'border-[var(--store-primary)]'
                      : 'border-border dark:border-border-dark hover:border-[var(--store-primary)]/50'
                  }`}
                >
                  <div className="relative w-full aspect-square bg-surface dark:bg-white/5 flex items-center justify-center">
                    {opt.imageUrl ? (
                      <img src={opt.imageUrl} alt={opt.value} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-text-muted">
                        <ImageOff size={22} />
                        <span className="text-lg font-bold">{opt.value}</span>
                      </div>
                    )}
                    {active && (
                      <span
                        className="absolute top-2 right-2 rounded-full p-1 shadow-sm text-[var(--store-button-text)]"
                        style={{ backgroundColor: 'var(--store-primary)' }}
                      >
                        <Check size={14} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <p className="px-2 py-2 text-sm font-semibold text-center text-text-primary dark:text-stone-100 truncate">
                    {opt.value}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
