'use client'

import { Scissors as ScissorsIcon, Loader2 } from 'lucide-react'
import { useMontagemStore } from '@/lib/montagem/store'
import { SliderField } from '@/components/ui/SliderField'
import { Toggle } from '@/components/ui/Toggle'

export function CutContourPanel() {
  const art = useMontagemStore((s) => s.art)
  const cutContour = useMontagemStore((s) => s.cutContour)
  const cutContourOffsetMm = useMontagemStore((s) => s.cutContourOffsetMm)
  const generateCutContour = useMontagemStore((s) => s.generateCutContour)
  const clearCutContour = useMontagemStore((s) => s.clearCutContour)
  const setCutContourOffsetMm = useMontagemStore((s) => s.setCutContourOffsetMm)
  const loading = useMontagemStore((s) => s.loading)
  const error = useMontagemStore((s) => s.error)

  const enabled = cutContour != null
  const canGenerate = !!art?.hasAlpha

  function handleToggle(value: boolean) {
    if (value) generateCutContour()
    else clearCutContour()
  }

  function handleOffsetCommit(v: number) {
    setCutContourOffsetMm(v)
    if (enabled) generateCutContour()
  }

  return (
    <div className="card rounded-2xl p-4 space-y-3">
      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <span className="flex items-center gap-2 font-semibold text-sm text-text-primary dark:text-stone-100">
          {loading ? <Loader2 size={16} className="animate-spin text-primary" /> : <ScissorsIcon size={16} className={enabled ? 'text-primary' : 'text-text-muted'} />}
          Linha de corte (faca)
        </span>
        <Toggle checked={enabled} onChange={handleToggle} disabled={!canGenerate || loading} label="Gerar linha de corte" />
      </label>

      {!canGenerate && (
        <p className="text-[11px] text-text-muted">
          Use &ldquo;Remover fundo&rdquo; nos ajustes da arte primeiro — a linha de corte segue o contorno real da arte, que só existe com transparência.
        </p>
      )}

      {canGenerate && (
        <>
          <SliderField
            label="Distância da arte"
            value={cutContourOffsetMm}
            min={0}
            max={15}
            step={0.1}
            onChange={setCutContourOffsetMm}
            onCommit={handleOffsetCommit}
            disabled={loading}
          />
          <p className="text-[11px] text-text-muted">
            Contorno vetorizado ao redor da arte (não a volta de cada letra), atualiza ao soltar. Pronto para abrir em CorelDRAW, FlexiSign ou SignCut.
          </p>
        </>
      )}

      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}
