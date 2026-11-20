'use client'

import { useState } from 'react'
import { Download, FileDown, Image as ImageIcon, Loader2 } from 'lucide-react'
import { useMontagemStore, useMontagemComparison } from '@/lib/montagem/store'
import { exportPng, downloadBlob } from '@/lib/montagem/exportPng'
import { exportPdf } from '@/lib/montagem/exportPdf'

export function ExportPanel() {
  const art = useMontagemStore((s) => s.art)
  const mode = useMontagemStore((s) => s.mode)
  const bobina = useMontagemStore((s) => s.bobina)
  const folha = useMontagemStore((s) => s.folha)
  const cropMarks = useMontagemStore((s) => s.cropMarks)
  const comparison = useMontagemComparison()

  const [dpi, setDpi] = useState(300)
  const [transparentBg, setTransparentBg] = useState(false)
  const [busy, setBusy] = useState<'pdf' | 'png' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const margins = mode === 'folha' ? folha.margins : bobina.margins
  const spacing = mode === 'folha' ? folha.spacing : bobina.spacing
  const result = comparison?.best
  const canExport = !!art && !!result?.fits

  async function handleExportPng() {
    if (!art || !result) return
    setBusy('png'); setError(null)
    try {
      const blob = await exportPng(result, margins.left, margins.top, spacing.x, spacing.y, art.dataUrl, {
        dpi, transparentBg: transparentBg && art.hasAlpha, cropMarks,
      })
      downloadBlob(blob, `precy-montagem-${Date.now()}.png`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao exportar PNG.')
    } finally {
      setBusy(null)
    }
  }

  function handleExportPdf() {
    if (!art || !result) return
    setBusy('pdf'); setError(null)
    try {
      exportPdf(result, margins.left, margins.top, spacing.x, spacing.y, art.dataUrl, { cropMarks }, `precy-montagem-${Date.now()}.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao exportar PDF.')
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

      {art?.hasAlpha && (
        <label className="flex items-center gap-2 text-sm text-text-secondary dark:text-stone-400">
          <input type="checkbox" checked={transparentBg} onChange={(e) => setTransparentBg(e.target.checked)} />
          Fundo transparente no PNG
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

      {!canExport && art && <p className="text-xs text-error">Corrija a montagem para exportar.</p>}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}
