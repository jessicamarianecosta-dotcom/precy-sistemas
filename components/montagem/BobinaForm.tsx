'use client'

import { useMontagemStore } from '@/lib/montagem/store'
import { NumberField, MarginsFields, SpacingFields } from './NumberField'

export function BobinaForm() {
  const bobina = useMontagemStore((s) => s.bobina)
  const updateBobina = useMontagemStore((s) => s.updateBobina)

  const lengthMode = bobina.desiredQty == null

  return (
    <div className="space-y-4">
      <NumberField
        label="Largura da bobina (mm)"
        value={bobina.rollWidthMm}
        step={10}
        onChange={(rollWidthMm) => updateBobina({ rollWidthMm })}
      />

      <div className="flex gap-1.5 text-xs">
        <button
          onClick={() => updateBobina({ desiredQty: null, rollLengthMm: bobina.rollLengthMm ?? 300 })}
          className={`flex-1 py-1.5 rounded-lg font-semibold border ${lengthMode ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-secondary'}`}
        >
          Informar comprimento
        </button>
        <button
          onClick={() => updateBobina({ desiredQty: bobina.desiredQty ?? 100, rollLengthMm: null })}
          className={`flex-1 py-1.5 rounded-lg font-semibold border ${!lengthMode ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-secondary'}`}
        >
          Informar quantidade
        </button>
      </div>

      {lengthMode ? (
        <NumberField
          label="Comprimento disponível (mm)"
          value={bobina.rollLengthMm ?? 0}
          step={10}
          onChange={(rollLengthMm) => updateBobina({ rollLengthMm })}
        />
      ) : (
        <NumberField
          label="Quantidade desejada"
          value={bobina.desiredQty ?? 0}
          step={1}
          onChange={(desiredQty) => updateBobina({ desiredQty })}
        />
      )}

      <MarginsFields margins={bobina.margins} onChange={(margins) => updateBobina({ margins })} />
      <SpacingFields spacing={bobina.spacing} onChange={(spacing) => updateBobina({ spacing })} />

      <div className="border-t border-border dark:border-border-dark pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">Distribuição manual (opcional)</p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Colunas"
            value={bobina.manualCols ?? 0}
            step={1}
            onChange={(v) => updateBobina({ manualCols: v === 0 ? null : v })}
          />
          <NumberField
            label="Linhas"
            value={bobina.manualRows ?? 0}
            step={1}
            onChange={(v) => updateBobina({ manualRows: v === 0 ? null : v })}
          />
        </div>
        {(bobina.manualCols != null || bobina.manualRows != null) && (
          <button
            onClick={() => updateBobina({ manualCols: null, manualRows: null })}
            className="text-xs text-primary hover:underline mt-2"
          >
            Voltar para cálculo automático
          </button>
        )}
      </div>
    </div>
  )
}
