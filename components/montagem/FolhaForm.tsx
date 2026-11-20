'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { SHEET_PRESETS } from '@/lib/montagem/packing'
import { useMontagemStore } from '@/lib/montagem/store'
import type { SheetPreset } from '@/lib/montagem/types'
import { NumberField, MarginsFields, SpacingFields, UnitToggle } from './NumberField'
import { fromMm, toMm, type Unit } from '@/lib/montagem/units'

const PRESETS: SheetPreset[] = ['A4', 'A3', 'A5', 'custom']

export function FolhaForm() {
  const folha = useMontagemStore((s) => s.folha)
  const updateFolha = useMontagemStore((s) => s.updateFolha)
  const applyPreset = useMontagemStore((s) => s.applyPreset)
  const [unit, setUnit] = useState<Unit>('cm')

  const toUnit = (mm: number) => round(fromMm(mm, unit))
  const toMmVal = (v: number) => toMm(v, unit)

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-text-secondary dark:text-stone-400">Tamanho da folha</label>
        <div className="grid grid-cols-4 gap-1.5 mt-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={clsx(
                'py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                folha.preset === p ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400 hover:border-primary',
              )}
            >
              {p === 'custom' ? 'Personalizada' : p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Medidas em</p>
        <UnitToggle unit={unit} onChange={setUnit} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={`Largura da folha (${unit})`} value={toUnit(folha.sheetWidthMm)}
          onChange={(v) => updateFolha({ sheetWidthMm: toMmVal(v), preset: 'custom' })}
        />
        <NumberField
          label={`Altura da folha (${unit})`} value={toUnit(folha.sheetHeightMm)}
          onChange={(v) => updateFolha({ sheetHeightMm: toMmVal(v), preset: 'custom' })}
        />
      </div>

      <MarginsFields
        unit={unit}
        margins={{
          top: toUnit(folha.margins.top), right: toUnit(folha.margins.right),
          bottom: toUnit(folha.margins.bottom), left: toUnit(folha.margins.left),
        }}
        onChange={(m) => updateFolha({ margins: { top: toMmVal(m.top), right: toMmVal(m.right), bottom: toMmVal(m.bottom), left: toMmVal(m.left) } })}
      />
      <SpacingFields
        unit={unit}
        spacing={{ x: toUnit(folha.spacing.x), y: toUnit(folha.spacing.y) }}
        onChange={(s) => updateFolha({ spacing: { x: toMmVal(s.x), y: toMmVal(s.y) } })}
      />

      <NumberField
        label="Quantidade desejada (opcional)" value={folha.desiredQty ?? 0} step={1}
        onChange={(v) => updateFolha({ desiredQty: v === 0 ? null : v })}
      />

      <div className="border-t border-border dark:border-border-dark pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">Distribuição manual (opcional)</p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Colunas" value={folha.manualCols ?? 0} step={1}
            onChange={(v) => updateFolha({ manualCols: v === 0 ? null : v })}
          />
          <NumberField
            label="Linhas" value={folha.manualRows ?? 0} step={1}
            onChange={(v) => updateFolha({ manualRows: v === 0 ? null : v })}
          />
        </div>
        {(folha.manualCols != null || folha.manualRows != null) && (
          <button
            onClick={() => updateFolha({ manualCols: null, manualRows: null })}
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
