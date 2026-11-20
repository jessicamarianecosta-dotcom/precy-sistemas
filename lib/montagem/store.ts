import { useMemo } from 'react'
import { create } from 'zustand'
import { SHEET_PRESETS, packBobina, packFolha } from './packing'
import { rotateArt } from './fileImport'
import type { AssemblyMode, BobinaConfig, CropMarksConfig, FolhaConfig, ImportedArt, PackingComparison, Rotation } from './types'

const DEFAULT_MARGINS = { top: 10, right: 10, bottom: 10, left: 10 }
const DEFAULT_SPACING = { x: 2, y: 2 }

function defaultBobina(): BobinaConfig {
  return {
    rollWidthMm: 1200,
    rollLengthMm: 300,
    desiredQty: null,
    margins: { ...DEFAULT_MARGINS },
    spacing: { ...DEFAULT_SPACING },
    manualCols: null,
    manualRows: null,
    preferRotated: null,
  }
}

function defaultFolha(): FolhaConfig {
  return {
    preset: 'A4',
    sheetWidthMm: SHEET_PRESETS.A4.widthMm,
    sheetHeightMm: SHEET_PRESETS.A4.heightMm,
    margins: { ...DEFAULT_MARGINS },
    spacing: { ...DEFAULT_SPACING },
    desiredQty: null,
    manualCols: null,
    manualRows: null,
    preferRotated: null,
  }
}

function defaultCropMarks(): CropMarksConfig {
  return { enabled: false, bleedMm: 0, markLengthMm: 4, markOffsetMm: 2 }
}

interface Snapshot {
  mode: AssemblyMode
  bobina: BobinaConfig
  folha: FolhaConfig
  cropMarks: CropMarksConfig
  rotation: Rotation
}

interface MontagemState {
  originalArt: ImportedArt | null
  art: ImportedArt | null // já rotacionado conforme `rotation`
  mode: AssemblyMode
  bobina: BobinaConfig
  folha: FolhaConfig
  cropMarks: CropMarksConfig
  rotation: Rotation
  zoom: number
  loading: boolean
  error: string | null

  past: Snapshot[]
  future: Snapshot[]

  setArt: (art: ImportedArt) => void
  clearArt: () => void
  setMode: (mode: AssemblyMode) => void
  updateBobina: (patch: Partial<BobinaConfig>) => void
  updateFolha: (patch: Partial<FolhaConfig>) => void
  applyPreset: (preset: FolhaConfig['preset']) => void
  updateCropMarks: (patch: Partial<CropMarksConfig>) => void
  setRotation: (rotation: Rotation) => Promise<void>
  setZoom: (zoom: number) => void
  undo: () => void
  redo: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  getComparison: () => PackingComparison | null
}

function snapshotOf(s: MontagemState): Snapshot {
  return {
    mode: s.mode,
    bobina: { ...s.bobina, margins: { ...s.bobina.margins }, spacing: { ...s.bobina.spacing } },
    folha: { ...s.folha, margins: { ...s.folha.margins }, spacing: { ...s.folha.spacing } },
    cropMarks: { ...s.cropMarks },
    rotation: s.rotation,
  }
}

export const useMontagemStore = create<MontagemState>((set, get) => ({
  originalArt: null,
  art: null,
  mode: 'folha',
  bobina: defaultBobina(),
  folha: defaultFolha(),
  cropMarks: defaultCropMarks(),
  rotation: 0,
  zoom: 1,
  loading: false,
  error: null,
  past: [],
  future: [],

  setArt: (art) => set({ originalArt: art, art, rotation: 0, error: null }),
  clearArt: () => set({ originalArt: null, art: null, rotation: 0 }),

  setMode: (mode) => {
    const snap = snapshotOf(get())
    set((s) => ({ mode, past: [...s.past, snap], future: [] }))
  },

  updateBobina: (patch) => {
    const snap = snapshotOf(get())
    set((s) => ({ bobina: { ...s.bobina, ...patch }, past: [...s.past, snap], future: [] }))
  },

  updateFolha: (patch) => {
    const snap = snapshotOf(get())
    set((s) => ({ folha: { ...s.folha, ...patch }, past: [...s.past, snap], future: [] }))
  },

  applyPreset: (preset) => {
    const snap = snapshotOf(get())
    const dims = preset === 'custom' ? null : SHEET_PRESETS[preset]
    set((s) => ({
      folha: {
        ...s.folha,
        preset,
        sheetWidthMm: dims ? dims.widthMm : s.folha.sheetWidthMm,
        sheetHeightMm: dims ? dims.heightMm : s.folha.sheetHeightMm,
      },
      past: [...s.past, snap],
      future: [],
    }))
  },

  updateCropMarks: (patch) => set((s) => ({ cropMarks: { ...s.cropMarks, ...patch } })),

  setRotation: async (rotation) => {
    const { originalArt } = get()
    if (!originalArt) return
    const snap = snapshotOf(get())
    set({ loading: true })
    try {
      const rotated = await rotateArt(originalArt, rotation)
      set((s) => ({ art: rotated, rotation, loading: false, past: [...s.past, snap], future: [] }))
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Falha ao rotacionar a arte.' })
    }
  },

  setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.1, zoom)) }),

  undo: () => {
    const { past } = get()
    if (past.length === 0) return
    const previous = past[past.length - 1]
    const currentSnap = snapshotOf(get())
    set((s) => ({
      ...previous,
      past: s.past.slice(0, -1),
      future: [currentSnap, ...s.future],
    }))
  },

  redo: () => {
    const { future } = get()
    if (future.length === 0) return
    const next = future[0]
    const currentSnap = snapshotOf(get())
    set((s) => ({
      ...next,
      future: s.future.slice(1),
      past: [...s.past, currentSnap],
    }))
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  getComparison: () => {
    const s = get()
    if (!s.art) return null
    if (s.mode === 'folha') return packFolha(s.folha, s.art.widthMm, s.art.heightMm)
    return packBobina(s.bobina, s.art.widthMm, s.art.heightMm)
  },
}))

/**
 * Hook reativo para o resultado do cálculo — recalcula sempre que arte, modo
 * ou configuração mudam. `getComparison()` na store não é reativo por si só
 * (lê via `get()`), por isso os componentes devem usar este hook.
 */
export function useMontagemComparison(): PackingComparison | null {
  const art = useMontagemStore((s) => s.art)
  const mode = useMontagemStore((s) => s.mode)
  const bobina = useMontagemStore((s) => s.bobina)
  const folha = useMontagemStore((s) => s.folha)

  return useMemo(() => {
    if (!art) return null
    if (mode === 'folha') return packFolha(folha, art.widthMm, art.heightMm)
    return packBobina(bobina, art.widthMm, art.heightMm)
  }, [art, mode, bobina, folha])
}
