'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, FileText, Printer, ChevronDown, Loader2, ReceiptText } from 'lucide-react'

export type PdfMode = 'cliente' | 'producao' | 'orcamento'

/** Só estes dois modos podem ser "padrão" da empresa. */
export type PdfDefaultTemplate = 'cliente' | 'producao'

interface Props {
  generating: boolean
  defaultTemplate?: PdfDefaultTemplate
  onSelect: (mode: PdfMode) => void
  variant?: 'full' | 'icon'
}

export function PdfExportMenu({ generating, defaultTemplate = 'cliente', onSelect, variant = 'full' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function pick(mode: PdfMode) {
    setOpen(false)
    if (!generating) onSelect(mode)
  }

  return (
    <div className="relative inline-block" ref={ref} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => !generating && setOpen(o => !o)}
        disabled={generating}
        title="Exportar PDF"
        className={
          variant === 'full'
            ? 'flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 bg-primary-50 dark:bg-primary/10 px-3 py-1.5 rounded-xl transition-colors'
            : 'p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-white/5 transition-colors'
        }
      >
        {generating ? (
          <Loader2 size={variant === 'full' ? 13 : 12} className="animate-spin" />
        ) : (
          <Download size={variant === 'full' ? 13 : 12} />
        )}
        {variant === 'full' && (
          <>
            Exportar PDF
            <ChevronDown size={12} />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl shadow-lg z-50 overflow-hidden py-1">
          <button
            type="button"
            onClick={() => pick('cliente')}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left text-text-primary dark:text-stone-200 hover:bg-primary-50 dark:hover:bg-white/5 transition-colors"
          >
            <FileText size={14} className="text-primary flex-shrink-0" />
            <span className="flex-1">📄 PDF Cliente</span>
            {defaultTemplate === 'cliente' && (
              <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wide">padrão</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => pick('producao')}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left text-text-primary dark:text-stone-200 hover:bg-primary-50 dark:hover:bg-white/5 transition-colors"
          >
            <Printer size={14} className="text-primary flex-shrink-0" />
            <span className="flex-1">🖨 Ficha de Produção</span>
            {defaultTemplate === 'producao' && (
              <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wide">padrão</span>
            )}
          </button>
          <div className="my-1 border-t border-border dark:border-border-dark" />
          <button
            type="button"
            onClick={() => pick('orcamento')}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left text-text-primary dark:text-stone-200 hover:bg-primary-50 dark:hover:bg-white/5 transition-colors"
          >
            <ReceiptText size={14} className="text-primary flex-shrink-0" />
            <span className="flex-1">📄 Baixar orçamento</span>
          </button>
        </div>
      )}
    </div>
  )
}
