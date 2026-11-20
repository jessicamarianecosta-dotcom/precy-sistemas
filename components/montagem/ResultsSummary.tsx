'use client'

import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react'
import { useMontagemStore, useMontagemComparison } from '@/lib/montagem/store'
import { formatArea, formatMm, formatPercent } from '@/lib/montagem/units'

export function ResultsSummary() {
  const comparison = useMontagemComparison()
  const mode = useMontagemStore((s) => s.mode)
  const folha = useMontagemStore((s) => s.folha)
  const bobina = useMontagemStore((s) => s.bobina)
  const updateFolha = useMontagemStore((s) => s.updateFolha)
  const updateBobina = useMontagemStore((s) => s.updateBobina)

  if (!comparison) {
    return (
      <div className="card rounded-2xl p-5 text-center text-sm text-text-secondary dark:text-stone-400">
        Importe um arquivo para calcular o aproveitamento.
      </div>
    )
  }

  const { best, normal, rotated } = comparison
  const hasAlternative = normal.total !== rotated.total && normal.fits && rotated.fits

  function setPreferRotated(value: boolean) {
    if (mode === 'folha') updateFolha({ preferRotated: value })
    else updateBobina({ preferRotated: value })
  }

  const desiredQty = mode === 'folha' ? folha.desiredQty : null
  const sheetsNeeded = desiredQty && best.fits && best.total > 0 ? Math.ceil(desiredQty / best.total) : null

  return (
    <div className="card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text-primary dark:text-stone-100">Aproveitamento</h3>
        {best.fits ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 size={14} /> Encaixa</span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-semibold text-error"><AlertTriangle size={14} /> Não encaixa</span>
        )}
      </div>

      {!best.fits && best.reason && (
        <p className="text-sm text-error bg-error-light rounded-lg px-3 py-2">{best.reason}</p>
      )}

      {best.fits && (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Metric label="Colunas" value={String(best.cols)} />
            <Metric label="Linhas" value={String(best.rows)} />
            <Metric label="Total de peças" value={String(best.total)} big />
            <Metric label="Aproveitamento" value={formatPercent(best.utilizationPct)} big />
            <Metric label="Área usada" value={formatArea(best.usedAreaMm2)} />
            <Metric label="Área desperdiçada" value={formatArea(best.wasteAreaMm2)} />
          </div>

          {best.lengthNeededMm != null && (
            <Metric label="Comprimento de bobina necessário" value={formatMm(best.lengthNeededMm, 'cm')} />
          )}
          {sheetsNeeded != null && (
            <Metric label={`Folhas necessárias para ${desiredQty} unidades`} value={String(sheetsNeeded)} />
          )}

          {hasAlternative && (
            <div className="border-t border-border dark:border-border-dark pt-3">
              <p className="text-xs font-medium text-text-secondary dark:text-stone-400 mb-2 flex items-center gap-1">
                <RotateCcw size={12} /> Comparar orientações
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPreferRotated(false)}
                  className={`text-left rounded-lg border px-3 py-2 text-xs transition-colors ${!best.rotated ? 'border-primary bg-primary-50' : 'border-border dark:border-border-dark'}`}
                >
                  <div className="font-semibold text-text-primary dark:text-stone-100">Normal</div>
                  <div className="text-text-secondary dark:text-stone-400">{normal.total} peças</div>
                </button>
                <button
                  onClick={() => setPreferRotated(true)}
                  className={`text-left rounded-lg border px-3 py-2 text-xs transition-colors ${best.rotated ? 'border-primary bg-primary-50' : 'border-border dark:border-border-dark'}`}
                >
                  <div className="font-semibold text-text-primary dark:text-stone-100">Girada 90°</div>
                  <div className="text-text-secondary dark:text-stone-400">{rotated.total} peças</div>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Metric({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <div className="text-xs text-text-secondary dark:text-stone-400">{label}</div>
      <div className={big ? 'text-xl font-bold text-primary' : 'text-sm font-semibold text-text-primary dark:text-stone-100'}>{value}</div>
    </div>
  )
}
