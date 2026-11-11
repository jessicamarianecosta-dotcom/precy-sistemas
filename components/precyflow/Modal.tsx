'use client'

import { X } from 'lucide-react'

export function PrecyflowModal({
  title, onClose, children, maxWidth = 'max-w-lg',
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className={`pf-card w-full ${maxWidth} max-h-[90vh] overflow-y-auto p-5`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:pf-bg-primary-soft">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
