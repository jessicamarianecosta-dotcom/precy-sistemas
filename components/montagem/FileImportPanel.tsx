'use client'

import { useCallback, useRef, useState } from 'react'
import { UploadCloud, FileImage, FileText, RotateCw, RefreshCw, Lock, Unlock } from 'lucide-react'
import { clsx } from 'clsx'
import {
  importImageFile, openPdfFile, renderPdfPage, rotateArt,
  MontagemImportError, type PdfHandle,
} from '@/lib/montagem/fileImport'
import { useMontagemStore } from '@/lib/montagem/store'
import { fromMm, toMm, type Unit } from '@/lib/montagem/units'
import type { Rotation } from '@/lib/montagem/types'

export function FileImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [pdfHandle, setPdfHandle] = useState<PdfHandle | null>(null)
  const [pdfFileName, setPdfFileName] = useState('')
  const [unit, setUnit] = useState<Unit>('mm')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const art = useMontagemStore((s) => s.art)
  const originalArt = useMontagemStore((s) => s.originalArt)
  const rotation = useMontagemStore((s) => s.rotation)
  const setArt = useMontagemStore((s) => s.setArt)
  const clearArt = useMontagemStore((s) => s.clearArt)
  const setRotation = useMontagemStore((s) => s.setRotation)

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    setLocalError(null)
    setBusy(true)
    try {
      if (file.type === 'application/pdf') {
        const handle = await openPdfFile(file)
        setPdfHandle(handle)
        setPdfFileName(file.name)
        const art = await renderPdfPage(handle, 1, file.name)
        setArt(art)
      } else {
        setPdfHandle(null)
        const art = await importImageFile(file)
        setArt(art)
      }
    } catch (e) {
      setLocalError(e instanceof MontagemImportError ? e.message : 'Não foi possível importar o arquivo.')
    } finally {
      setBusy(false)
    }
  }, [setArt])

  async function handleSelectPage(pageIndex: number) {
    if (!pdfHandle) return
    setBusy(true)
    try {
      const rendered = await renderPdfPage(pdfHandle, pageIndex, pdfFileName)
      setArt(rendered)
    } catch (e) {
      setLocalError(e instanceof MontagemImportError ? e.message : 'Não foi possível renderizar a página.')
    } finally {
      setBusy(false)
    }
  }

  function updateDims(patch: { widthMm?: number; heightMm?: number }) {
    if (!art || !originalArt) return
    const aspect = originalArt.widthMm / originalArt.heightMm
    let widthMm = patch.widthMm ?? art.widthMm
    let heightMm = patch.heightMm ?? art.heightMm
    if (art.aspectLocked) {
      if (patch.widthMm != null) heightMm = widthMm / aspect
      else if (patch.heightMm != null) widthMm = heightMm * aspect
    }
    useMontagemStore.setState((s) => ({
      art: s.art ? { ...s.art, widthMm, heightMm } : s.art,
      originalArt: s.originalArt ? { ...s.originalArt, widthMm, heightMm } : s.originalArt,
    }))
  }

  function toggleAspectLock() {
    useMontagemStore.setState((s) => ({
      art: s.art ? { ...s.art, aspectLocked: !s.art.aspectLocked } : s.art,
      originalArt: s.originalArt ? { ...s.originalArt, aspectLocked: !s.originalArt.aspectLocked } : s.originalArt,
    }))
  }

  if (!art) {
    return (
      <div
        className={clsx(
          'card border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer',
          dragOver ? 'border-primary bg-primary-50' : 'border-border dark:border-border-dark',
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <UploadCloud className="mx-auto mb-3 text-primary" size={40} />
        <p className="font-semibold text-text-primary dark:text-stone-100">Arraste seu arquivo aqui</p>
        <p className="text-sm text-text-secondary dark:text-stone-400 mt-1">ou clique para selecionar — PNG, JPG ou PDF</p>
        {busy && <p className="text-sm text-primary mt-3">Importando…</p>}
        {localError && <p className="text-sm text-error mt-3">{localError}</p>}
      </div>
    )
  }

  return (
    <div className="card rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {art.kind === 'pdf' ? <FileText size={18} className="text-primary flex-shrink-0" /> : <FileImage size={18} className="text-primary flex-shrink-0" />}
          <span className="text-sm font-medium truncate text-text-primary dark:text-stone-100">{art.name}</span>
        </div>
        <button
          onClick={() => { clearArt(); setPdfHandle(null) }}
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1 flex-shrink-0"
        >
          <RefreshCw size={12} /> Substituir
        </button>
      </div>

      <div className="rounded-xl overflow-hidden border border-border dark:border-border-dark bg-stone-100 dark:bg-stone-900 flex items-center justify-center" style={{ height: 140 }}>
        <img src={art.dataUrl} alt={art.name} className="max-h-full max-w-full object-contain" />
      </div>

      {art.kind === 'pdf' && art.pageCount && art.pageCount > 1 && (
        <div>
          <label className="text-xs font-medium text-text-secondary dark:text-stone-400">Página do PDF</label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {Array.from({ length: art.pageCount }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => handleSelectPage(p)}
                className={clsx(
                  'w-8 h-8 rounded-lg text-xs font-semibold border transition-colors',
                  art.pageIndex === p
                    ? 'bg-primary text-white border-primary'
                    : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400 hover:border-primary',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-text-secondary dark:text-stone-400">Largura</label>
          <input
            type="number" step="0.1" className="input mt-1"
            value={round2(fromMm(art.widthMm, unit))}
            onChange={(e) => updateDims({ widthMm: toMm(parseFloat(e.target.value) || 0, unit) })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary dark:text-stone-400">Altura</label>
          <input
            type="number" step="0.1" className="input mt-1"
            value={round2(fromMm(art.heightMm, unit))}
            onChange={(e) => updateDims({ heightMm: toMm(parseFloat(e.target.value) || 0, unit) })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {(['mm', 'cm', 'm'] as Unit[]).map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors',
                unit === u ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400',
              )}
            >
              {u}
            </button>
          ))}
        </div>
        <button
          onClick={toggleAspectLock}
          className="flex items-center gap-1 text-xs font-medium text-text-secondary dark:text-stone-400 hover:text-primary"
          title="Manter proporção"
        >
          {art.aspectLocked ? <Lock size={14} /> : <Unlock size={14} />}
          {art.aspectLocked ? 'Proporção travada' : 'Proporção livre'}
        </button>
      </div>

      <div>
        <label className="text-xs font-medium text-text-secondary dark:text-stone-400">Rotação</label>
        <div className="flex gap-1.5 mt-1.5">
          {([0, 90, 180, 270] as Rotation[]).map((r) => (
            <button
              key={r}
              onClick={() => setRotation(r)}
              className={clsx(
                'flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center justify-center gap-1',
                rotation === r ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400 hover:border-primary',
              )}
            >
              <RotateCw size={12} /> {r}°
            </button>
          ))}
        </div>
      </div>

      {art.hasAlpha && (
        <p className="text-xs text-success bg-success-light rounded-lg px-2.5 py-1.5">Fundo transparente detectado.</p>
      )}
      {localError && <p className="text-sm text-error">{localError}</p>}
    </div>
  )
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
