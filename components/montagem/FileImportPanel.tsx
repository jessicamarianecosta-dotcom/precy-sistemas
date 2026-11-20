'use client'

import { useCallback, useRef, useState } from 'react'
import { UploadCloud, FileImage, FileText, RotateCw, RefreshCw, Lock, Unlock, Crop, Sparkles, Loader2, Eraser, Square, Circle } from 'lucide-react'
import { Toggle } from '@/components/ui/Toggle'
import { clsx } from 'clsx'
import {
  importImageFile, openPdfFile, renderPdfPage, rotateArt,
  MontagemImportError, type PdfHandle,
} from '@/lib/montagem/fileImport'
import { createShapeArt, type SimpleShape } from '@/lib/montagem/shapeArt'
import { useMontagemStore } from '@/lib/montagem/store'
import { fromMm, toMm, type Unit } from '@/lib/montagem/units'
import type { Rotation } from '@/lib/montagem/types'
import { NumberInput } from '@/components/ui/NumberInput'

export function FileImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [pdfHandle, setPdfHandle] = useState<PdfHandle | null>(null)
  const [pdfFileName, setPdfFileName] = useState('')
  const [unit, setUnit] = useState<Unit>('mm')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const [importTab, setImportTab] = useState<'file' | 'shape'>('file')
  const [shapeType, setShapeType] = useState<SimpleShape>('rect')
  const [shapeWidth, setShapeWidth] = useState(90)
  const [shapeHeight, setShapeHeight] = useState(50)

  const art = useMontagemStore((s) => s.art)
  const originalArt = useMontagemStore((s) => s.originalArt)
  const rotation = useMontagemStore((s) => s.rotation)
  const setArt = useMontagemStore((s) => s.setArt)
  const clearArt = useMontagemStore((s) => s.clearArt)
  const setRotation = useMontagemStore((s) => s.setRotation)
  const trimArtBackground = useMontagemStore((s) => s.trimArtBackground)
  const backgroundRemoval = useMontagemStore((s) => s.backgroundRemoval)
  const setBackgroundRemovalEnabled = useMontagemStore((s) => s.setBackgroundRemovalEnabled)
  const setBackgroundRemovalRemoveHoles = useMontagemStore((s) => s.setBackgroundRemovalRemoveHoles)
  const upscale = useMontagemStore((s) => s.upscale)
  const setUpscaleFactor = useMontagemStore((s) => s.setUpscaleFactor)
  const processing = useMontagemStore((s) => s.loading)
  const processingError = useMontagemStore((s) => s.error)

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

  function handleUseShape() {
    setLocalError(null)
    try {
      const widthMm = toMm(shapeWidth, unit)
      const heightMm = shapeType === 'circle' ? widthMm : toMm(shapeHeight, unit)
      const art = createShapeArt(shapeType, widthMm, heightMm)
      setArt(art)
    } catch (e) {
      setLocalError(e instanceof MontagemImportError ? e.message : 'Não foi possível criar a forma.')
    }
  }

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
      <div className="card rounded-2xl p-4 space-y-4">
        <div className="flex gap-1.5 bg-stone-100 dark:bg-stone-900 rounded-xl p-1">
          <button
            onClick={() => setImportTab('file')}
            className={clsx('flex-1 py-2 rounded-lg text-sm font-semibold transition-colors', importTab === 'file' ? 'bg-white dark:bg-surface-dark shadow-sm text-primary' : 'text-text-secondary dark:text-stone-400')}
          >
            Importar arquivo
          </button>
          <button
            onClick={() => setImportTab('shape')}
            className={clsx('flex-1 py-2 rounded-lg text-sm font-semibold transition-colors', importTab === 'shape' ? 'bg-white dark:bg-surface-dark shadow-sm text-primary' : 'text-text-secondary dark:text-stone-400')}
          >
            Forma simples
          </button>
        </div>

        {importTab === 'file' ? (
          <div
            className={clsx(
              'border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer',
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
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">
              Sem arquivo ainda? Use uma forma simples só para calcular quantas peças cabem — depois é só substituir pela arte final.
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setShapeType('rect')}
                className={clsx('flex-1 py-2 rounded-lg text-sm font-semibold border flex items-center justify-center gap-1.5', shapeType === 'rect' ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400')}
              >
                <Square size={14} /> Quadrado/Retângulo
              </button>
              <button
                onClick={() => setShapeType('circle')}
                className={clsx('flex-1 py-2 rounded-lg text-sm font-semibold border flex items-center justify-center gap-1.5', shapeType === 'circle' ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400')}
              >
                <Circle size={14} /> Redondo
              </button>
            </div>

            <div className={clsx('grid gap-3', shapeType === 'circle' ? 'grid-cols-1' : 'grid-cols-2')}>
              <div>
                <label className="text-xs font-medium text-text-secondary dark:text-stone-400">{shapeType === 'circle' ? 'Diâmetro' : 'Largura'}</label>
                <NumberInput className="input mt-1 w-full" value={shapeWidth} onChange={setShapeWidth} />
              </div>
              {shapeType === 'rect' && (
                <div>
                  <label className="text-xs font-medium text-text-secondary dark:text-stone-400">Altura</label>
                  <NumberInput className="input mt-1 w-full" value={shapeHeight} onChange={setShapeHeight} />
                </div>
              )}
            </div>

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

            <button onClick={handleUseShape} className="btn-primary w-full">Usar esta forma</button>
          </div>
        )}
        {localError && <p className="text-sm text-error">{localError}</p>}
      </div>
    )
  }

  return (
    <div className="card rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {art.kind === 'pdf' && <FileText size={18} className="text-primary flex-shrink-0" />}
          {art.kind === 'image' && <FileImage size={18} className="text-primary flex-shrink-0" />}
          {art.kind === 'shape' && <Square size={18} className="text-primary flex-shrink-0" />}
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
          <NumberInput
            className="input mt-1 w-full"
            value={round2(fromMm(art.widthMm, unit))}
            onChange={(v) => updateDims({ widthMm: toMm(v, unit) })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary dark:text-stone-400">Altura</label>
          <NumberInput
            className="input mt-1 w-full"
            value={round2(fromMm(art.heightMm, unit))}
            onChange={(v) => updateDims({ heightMm: toMm(v, unit) })}
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

      {art.kind !== 'shape' && (
      <div className="border-t border-border dark:border-border-dark pt-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Ajustes da arte</p>

        <button
          onClick={() => trimArtBackground()}
          disabled={processing}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold border border-border dark:border-border-dark text-text-primary dark:text-stone-100 hover:border-primary disabled:opacity-50"
        >
          {processing ? <Loader2 size={14} className="animate-spin" /> : <Crop size={14} className="text-primary" />}
          Recortar fundo automaticamente
        </button>
        <p className="text-[11px] text-text-muted -mt-2">
          Rastreia a arte e corta a margem de fundo (branco ou transparente), ajustando a medida para o tamanho real.
        </p>

        <div className="rounded-lg border border-border dark:border-border-dark p-3 space-y-2.5">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="flex items-center gap-2 text-sm font-semibold text-text-primary dark:text-stone-100">
              {processing ? <Loader2 size={14} className="animate-spin flex-shrink-0" /> : <Eraser size={14} className="text-primary flex-shrink-0" />}
              Remover fundo (deixar transparente)
            </span>
            <Toggle
              checked={backgroundRemoval.enabled}
              onChange={(v) => setBackgroundRemovalEnabled(v)}
              disabled={processing}
              label="Remover fundo"
            />
          </label>
          <p className="text-[11px] text-text-muted">
            Torna transparente só o fundo ao redor da arte, sem alterar cores. Reversível — pode ligar e desligar quando quiser.
          </p>
          {backgroundRemoval.enabled && (
            <label className="flex items-center gap-2 text-xs text-text-secondary dark:text-stone-400 pt-1 border-t border-border dark:border-border-dark cursor-pointer">
              <input
                type="checkbox"
                checked={backgroundRemoval.removeHoles}
                onChange={(e) => setBackgroundRemovalRemoveHoles(e.target.checked)}
                disabled={processing}
              />
              Remover também buracos internos (ex: miolo de letras fechadas)
            </label>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-text-secondary dark:text-stone-400">Melhorar definição (upscale)</label>
          <div className="flex gap-1.5 mt-1.5">
            {([2, 3, 4] as const).map((f) => {
              const active = upscale.enabled && upscale.factor === f
              return (
                <button
                  key={f}
                  onClick={() => setUpscaleFactor(f)}
                  disabled={processing}
                  className={clsx(
                    'flex-1 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-50 flex items-center justify-center gap-1 transition-colors',
                    active ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400 hover:border-primary',
                  )}
                >
                  {processing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className={active ? '' : 'text-primary'} />}
                  {f}×
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-text-muted mt-1.5">
            Aumenta a resolução e a nitidez sem mudar cor, conteúdo ou o tamanho físico de impressão. Clique de novo pra desmarcar.
          </p>
        </div>
      </div>
      )}

      {art.kind === 'shape' && (
        <p className="text-xs text-primary bg-primary-50 dark:bg-primary/10 rounded-lg px-2.5 py-1.5">
          Forma simples, só para calcular o aproveitamento — substitua pela arte final em &ldquo;Substituir&rdquo; antes de exportar pra impressão de verdade.
        </p>
      )}

      {processingError && <p className="text-sm text-error">{processingError}</p>}

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
