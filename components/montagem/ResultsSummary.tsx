'use client'

import { AlertTriangle, CheckCircle2, RotateCw } from 'lucide-react'
import { useMontagemStore, useMontagemComparison } from '@/lib/montagem/store'
import { formatArea, formatMm, formatPercent } from '@/lib/montagem/units'
import type { Rotation } from '@/lib/montagem/types'

export function ResultsSummary() {
  const comparison = useMontagemComparison()
  const mode = useMontagemStore((s) => s.mode)
  const folha = useMontagemStore((s) => s.folha)
  const bobina = useMontagemStore((s) => s.bobina)
  const rotation = useMontagemStore((s) => s.rotation)
  const setRotation = useMontagemStore((s) => s.setRotation)
  const loading = useMontagemStore((s) => s.loading)

  if (!comparison) {
    return (
      <div className="card rounded-2xl p-5 text-center text-sm text-text-secondary dark:text-stone-400">
        Importe um arquivo para calcular o aproveitamento.
      </div>
    )
  }

  const { best, normal, rotated } = comparison
  const isBobinaQtyMode = mode === 'bobina' && bobina.desiredQty != null
  // No modo "quantidade desejada" da bobina a escolha de orientação já é
  // automática (a que precisa de menos linhas/comprimento) — mostrar os dois
  // totais lado a lado só confunde, porque nenhum dos dois é "a quantidade
  // pedida", e sim o total arredondado pra completar a última linha.
  const showRotateSuggestion = !isBobinaQtyMode && rotated.total > normal.total && rotated.fits

  function rotateAndRecalculate() {
    const next = ((rotation + 90) % 360) as Rotation
    setRotation(next)
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
            <Metric label={isBobinaQtyMode ? 'Total produzido (linha completa)' : 'Total de peças'} value={String(best.total)} big />
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

          {showRotateSuggestion && (
            <div className="border-t border-border dark:border-border-dark pt-3">
              <button
                onClick={rotateAndRecalculate}
                disabled={loading}
                className="w-full flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary-50 dark:bg-primary/10 px-3 py-2.5 text-left hover:border-primary transition-colors disabled:opacity-50"
              >
                <span className="text-xs text-text-primary dark:text-stone-100">
                  Girando a arte 90°, você aproveitaria <strong>{rotated.total}</strong> peças em vez de {normal.total}.
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-primary flex-shrink-0">
                  <RotateCw size={14} /> Girar
                </span>
              </button>
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
