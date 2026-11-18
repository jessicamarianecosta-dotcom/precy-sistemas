'use client'

import { X } from 'lucide-react'
import { useEffect } from 'react'

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-6`}
        style={{ backgroundColor: 'var(--pf-surface)', border: '1px solid var(--pf-border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: 'var(--pf-text)' }}>{title}</h2>
          <button onClick={onClose} aria-label="Fechar" style={{ color: 'var(--pf-text-secondary)' }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
