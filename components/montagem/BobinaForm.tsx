'use client'

import { useState } from 'react'
import { useMontagemStore } from '@/lib/montagem/store'
import { NumberField, MarginsFields, SpacingFields, UnitToggle } from './NumberField'
import { fromMm, toMm, type Unit } from '@/lib/montagem/units'

export function BobinaForm() {
  const bobina = useMontagemStore((s) => s.bobina)
  const updateBobina = useMontagemStore((s) => s.updateBobina)
  const [unit, setUnit] = useState<Unit>('cm')

  const lengthMode = bobina.desiredQty == null
  const toUnit = (mm: number) => round(fromMm(mm, unit))
  const toMmVal = (v: number) => toMm(v, unit)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Medidas em</p>
        <UnitToggle unit={unit} onChange={setUnit} />
      </div>

      <NumberField
        label={`Largura da bobina (${unit})`}
        value={toUnit(bobina.rollWidthMm)}
        onChange={(v) => updateBobina({ rollWidthMm: toMmVal(v) })}
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
          label={`Comprimento disponível (${unit})`}
          value={toUnit(bobina.rollLengthMm ?? 0)}
          onChange={(v) => updateBobina({ rollLengthMm: toMmVal(v) })}
        />
      ) : (
        <NumberField
          label="Quantidade desejada"
          value={bobina.desiredQty ?? 0}
          step={1}
          onChange={(desiredQty) => updateBobina({ desiredQty })}
        />
      )}

      <MarginsFields
        unit={unit}
        margins={{
          top: toUnit(bobina.margins.top), right: toUnit(bobina.margins.right),
          bottom: toUnit(bobina.margins.bottom), left: toUnit(bobina.margins.left),
        }}
        onChange={(m) => updateBobina({ margins: { top: toMmVal(m.top), right: toMmVal(m.right), bottom: toMmVal(m.bottom), left: toMmVal(m.left) } })}
      />
      <SpacingFields
        unit={unit}
        spacing={{ x: toUnit(bobina.spacing.x), y: toUnit(bobina.spacing.y) }}
        onChange={(s) => updateBobina({ spacing: { x: toMmVal(s.x), y: toMmVal(s.y) } })}
      />

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

function round(v: number): number {
  return Math.round(v * 1000) / 1000
}
