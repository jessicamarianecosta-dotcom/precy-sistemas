'use client'

import { useState } from 'react'
import { Download, FileDown, Image as ImageIcon, Loader2, Scissors } from 'lucide-react'
import { clsx } from 'clsx'
import { useMontagemStore, useMontagemComparison } from '@/lib/montagem/store'
import { exportPng, downloadBlob } from '@/lib/montagem/exportPng'
import { exportPdf } from '@/lib/montagem/exportPdf'
import { exportCutContourPdf, exportCutContourSvg } from '@/lib/montagem/exportCutContour'
import { singleItemResult, tightenRollLength, tightenRollWidth } from '@/lib/montagem/packing'

type Background = 'white' | 'transparent'

export function ExportPanel() {
  const art = useMontagemStore((s) => s.art)
  const mode = useMontagemStore((s) => s.mode)
  const bobina = useMontagemStore((s) => s.bobina)
  const folha = useMontagemStore((s) => s.folha)
  const cropMarks = useMontagemStore((s) => s.cropMarks)
  const cutContour = useMontagemStore((s) => s.cutContour)
  const comparison = useMontagemComparison()

  const [dpi, setDpi] = useState(300)
  const [background, setBackground] = useState<Background>('white')
  const [includeCutContour, setIncludeCutContour] = useState(true)
  const [busy, setBusy] = useState<'pdf' | 'png' | 'faca-pdf' | 'faca-svg' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scope, setScope] = useState<'grid' | 'single'>('grid')

  const margins = mode === 'folha' ? folha.margins : bobina.margins
  const spacing = mode === 'folha' ? folha.spacing : bobina.spacing
  const result = comparison?.best
  const canUseTransparent = !!art?.hasAlpha
  const effectiveBackground: Background = canUseTransparent ? background : 'white'

  // A largura/comprimento de bobina informados servem só pra calcular quantos
  // adesivos cabem — a impressão real roda noutro programa, então o arquivo
  // exportado deve ter só o tamanho de fato usado pelas colunas/linhas, não o
  // valor digitado (que é só um limite físico de referência).
  const isBobinaLengthMode = mode === 'bobina' && bobina.desiredQty == null
  const gridResult = result && mode === 'bobina'
    ? tightenRollWidth(
        isBobinaLengthMode ? tightenRollLength(result, margins.top, margins.bottom, spacing.y) : result,
        margins.left, margins.right, spacing.x,
      )
    : result

  // "Peça única": baixa só a arte final (já com borda/faca, se ativas) no
  // tamanho dela mesma, sem multiplicar em folha ou bobina — reaproveita as
  // mesmas funções de exportação com um resultado sintético de 1×1, sem
  // margem nem espaçamento.
  const exportResult = scope === 'single' && art ? singleItemResult(art.widthMm, art.heightMm) : gridResult
  const exportMarginLeft = scope === 'single' ? 0 : margins.left
  const exportMarginTop = scope === 'single' ? 0 : margins.top
  const exportSpacingX = scope === 'single' ? 0 : spacing.x
  const exportSpacingY = scope === 'single' ? 0 : spacing.y
  const canExport = scope === 'single' ? !!art : !!art && !!result?.fits

  async function handleExportPng() {
    if (!art || !exportResult) return
    setBusy('png'); setError(null)
    try {
      const blob = await exportPng(exportResult, exportMarginLeft, exportMarginTop, exportSpacingX, exportSpacingY, art.dataUrl, {
        dpi, transparentBg: effectiveBackground === 'transparent', cropMarks,
      })
      downloadBlob(blob, `precy-montagem-${Date.now()}.png`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao exportar PNG.')
    } finally {
      setBusy(null)
    }
  }

  function handleExportPdf() {
    if (!art || !exportResult) return
    setBusy('pdf'); setError(null)
    try {
      exportPdf(exportResult, exportMarginLeft, exportMarginTop, exportSpacingX, exportSpacingY, art.dataUrl, {
        cropMarks, background: effectiveBackground,
        cutContour: includeCutContour ? cutContour : null,
      }, `precy-montagem-${Date.now()}.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao exportar PDF.')
    } finally {
      setBusy(null)
    }
  }

  function handleExportFacaPdf() {
    if (!exportResult || !cutContour) return
    setBusy('faca-pdf'); setError(null)
    try {
      exportCutContourPdf(exportResult, exportMarginLeft, exportMarginTop, exportSpacingX, exportSpacingY, cutContour, `precy-faca-${Date.now()}.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao exportar a faca.')
    } finally {
      setBusy(null)
    }
  }

  function handleExportFacaSvg() {
    if (!exportResult || !cutContour) return
    setBusy('faca-svg'); setError(null)
    try {
      exportCutContourSvg(exportResult, exportMarginLeft, exportMarginTop, exportSpacingX, exportSpacingY, cutContour, `precy-faca-${Date.now()}.svg`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao exportar a faca.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="card rounded-2xl p-4 space-y-4">
      <h3 className="font-semibold text-text-primary dark:text-stone-100 flex items-center gap-2">
        <Download size={16} className="text-primary" /> Exportar
      </h3>

      <div>
        <label className="text-xs font-medium text-text-secondary dark:text-stone-400">O que exportar</label>
        <div className="flex gap-1.5 mt-1.5">
          <button
            onClick={() => setScope('grid')}
            className={clsx(
              'flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
              scope === 'grid' ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-secondary',
            )}
          >
            Grade completa
          </button>
          <button
            onClick={() => setScope('single')}
            disabled={!art}
            className={clsx(
              'flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              scope === 'single' ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-secondary',
            )}
          >
            Peça única
          </button>
        </div>
        {scope === 'single' && (
          <p className="text-[11px] text-text-muted mt-1.5">
            Baixa só esta arte (com borda/faca, se ativas), no tamanho dela mesma — sem multiplicar em folha ou bobina.
          </p>
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-text-secondary dark:text-stone-400">Resolução PNG (DPI)</label>
        <div className="flex gap-1.5 mt-1.5">
          {[150, 300, 600].map((d) => (
            <button
              key={d}
              onClick={() => setDpi(d)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${dpi === d ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-secondary'}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-text-secondary dark:text-stone-400">Fundo (PDF e PNG)</label>
        <div className="flex gap-1.5 mt-1.5">
          <button
            onClick={() => setBackground('white')}
            className={clsx(
              'flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
              effectiveBackground === 'white' ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-secondary',
            )}
          >
            Branco
          </button>
          <button
            onClick={() => canUseTransparent && setBackground('transparent')}
            disabled={!canUseTransparent}
            className={clsx(
              'flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              effectiveBackground === 'transparent' ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-secondary',
            )}
          >
            Transparente
          </button>
        </div>
        {!canUseTransparent && (
          <p className="text-[11px] text-text-muted mt-1.5">
            Esta arte não tem fundo transparente. Use &ldquo;Remover fundo&rdquo; nos ajustes da arte para habilitar.
          </p>
        )}
      </div>

      {cutContour && (
        <label className="flex items-center gap-2 text-sm text-text-secondary dark:text-stone-400 cursor-pointer">
          <input type="checkbox" checked={includeCutContour} onChange={(e) => setIncludeCutContour(e.target.checked)} />
          Incluir linha de corte no PDF (junto com a arte)
        </label>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleExportPdf}
          disabled={!canExport || busy !== null}
          className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
          PDF
        </button>
        <button
          onClick={handleExportPng}
          disabled={!canExport || busy !== null}
          className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy === 'png' ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
          PNG
        </button>
      </div>

      {cutContour && (
        <div className="border-t border-border dark:border-border-dark pt-3 space-y-2">
          <p className="text-xs font-medium text-text-secondary dark:text-stone-400 flex items-center gap-1.5">
            <Scissors size={12} className="text-primary" /> Faca separada (mesmas coordenadas da arte)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportFacaPdf}
              disabled={!canExport || busy !== null}
              className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              {busy === 'faca-pdf' ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
              PDF
            </button>
            <button
              onClick={handleExportFacaSvg}
              disabled={!canExport || busy !== null}
              className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              {busy === 'faca-svg' ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
              SVG
            </button>
          </div>
        </div>
      )}

      {!canExport && art && <p className="text-xs text-error">Corrija a montagem para exportar.</p>}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}
