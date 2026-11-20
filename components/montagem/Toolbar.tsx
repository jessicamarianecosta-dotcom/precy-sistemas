'use client'

import { Undo2, Redo2, Scissors } from 'lucide-react'
import { clsx } from 'clsx'
import { useMontagemStore } from '@/lib/montagem/store'
import { NumberField } from './NumberField'

export function ModeTabs() {
  const mode = useMontagemStore((s) => s.mode)
  const setMode = useMontagemStore((s) => s.setMode)

  return (
    <div className="flex gap-1.5 bg-stone-100 dark:bg-stone-900 rounded-xl p-1">
      <button
        onClick={() => setMode('folha')}
        className={clsx('flex-1 py-2 rounded-lg text-sm font-semibold transition-colors', mode === 'folha' ? 'bg-white dark:bg-surface-dark shadow-sm text-primary' : 'text-text-secondary dark:text-stone-400')}
      >
        Montagem em Folha
      </button>
      <button
        onClick={() => setMode('bobina')}
        className={clsx('flex-1 py-2 rounded-lg text-sm font-semibold transition-colors', mode === 'bobina' ? 'bg-white dark:bg-surface-dark shadow-sm text-primary' : 'text-text-secondary dark:text-stone-400')}
      >
        Montagem em Bobina
      </button>
    </div>
  )
}

export function UndoRedoButtons() {
  const past = useMontagemStore((s) => s.past)
  const future = useMontagemStore((s) => s.future)
  const undo = useMontagemStore((s) => s.undo)
  const redo = useMontagemStore((s) => s.redo)

  return (
    <div className="flex gap-1.5">
      <button
        onClick={undo}
        disabled={past.length === 0}
        className="p-2 rounded-lg border border-border dark:border-border-dark text-text-secondary disabled:opacity-40 hover:bg-primary-50"
        title="Desfazer"
      >
        <Undo2 size={16} />
      </button>
      <button
        onClick={redo}
        disabled={future.length === 0}
        className="p-2 rounded-lg border border-border dark:border-border-dark text-text-secondary disabled:opacity-40 hover:bg-primary-50"
        title="Refazer"
      >
        <Redo2 size={16} />
      </button>
    </div>
  )
}

export function CropMarksPanel() {
  const cropMarks = useMontagemStore((s) => s.cropMarks)
  const updateCropMarks = useMontagemStore((s) => s.updateCropMarks)

  return (
    <div className="card rounded-2xl p-4 space-y-3">
      <button
        onClick={() => updateCropMarks({ enabled: !cropMarks.enabled })}
        className="flex items-center gap-2 font-semibold text-sm text-text-primary dark:text-stone-100"
      >
        <Scissors size={16} className={cropMarks.enabled ? 'text-primary' : 'text-text-muted'} />
        Marcas de corte
        <span className={clsx('ml-auto text-xs px-2 py-0.5 rounded-full', cropMarks.enabled ? 'bg-primary text-white' : 'bg-stone-200 text-text-muted')}>
          {cropMarks.enabled ? 'Ativado' : 'Desativado'}
        </span>
      </button>
      {cropMarks.enabled && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <NumberField label="Comprimento da marca (mm)" value={cropMarks.markLengthMm} step={0.5} onChange={(markLengthMm) => updateCropMarks({ markLengthMm })} />
          <NumberField label="Distância da marca (mm)" value={cropMarks.markOffsetMm} step={0.5} onChange={(markOffsetMm) => updateCropMarks({ markOffsetMm })} />
        </div>
      )}
    </div>
  )
}
