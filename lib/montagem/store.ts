import { useMemo } from 'react'
import { create } from 'zustand'
import { SHEET_PRESETS, packBobina, packFolha } from './packing'
import { rotateArt } from './fileImport'
import { trimBackground, upscaleImage, removeBackgroundColor } from './imageProcessing'
import { addBorderToArt } from './addBorder'
import { generateCutContourForArt } from './cutContour'
import type { AssemblyMode, BobinaConfig, CropMarksConfig, CutContour, FolhaConfig, ImportedArt, PackingComparison, Rotation } from './types'

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
  }
}

function defaultCropMarks(): CropMarksConfig {
  return { enabled: false, bleedMm: 0, markLengthMm: 4, markOffsetMm: 2 }
}

interface BackgroundRemovalConfig {
  enabled: boolean
  removeHoles: boolean
}

function defaultBackgroundRemoval(): BackgroundRemovalConfig {
  return { enabled: false, removeHoles: false }
}

interface BorderConfig {
  enabled: boolean
  widthMm: number
  color: string
}

function defaultBorder(): BorderConfig {
  return { enabled: false, widthMm: 2, color: '#ffffff' }
}

interface UpscaleConfig {
  enabled: boolean
  factor: 2 | 3 | 4
}

function defaultUpscale(): UpscaleConfig {
  return { enabled: false, factor: 2 }
}

interface Snapshot {
  mode: AssemblyMode
  bobina: BobinaConfig
  folha: FolhaConfig
  cropMarks: CropMarksConfig
  rotation: Rotation
  backgroundRemoval: BackgroundRemovalConfig
  border: BorderConfig
  upscale: UpscaleConfig
}

interface MontagemState {
  /** Arte como veio do arquivo (já com recorte/upscale aplicados — esses são permanentes). Nunca tem rotação nem remoção de fundo aplicadas. */
  originalArt: ImportedArt | null
  /** Arte final (derivada de originalArt + remoção de fundo opcional + rotação) — é o que de fato é ladrilhado, visualizado e exportado. */
  art: ImportedArt | null
  mode: AssemblyMode
  bobina: BobinaConfig
  folha: FolhaConfig
  cropMarks: CropMarksConfig
  rotation: Rotation
  backgroundRemoval: BackgroundRemovalConfig
  border: BorderConfig
  upscale: UpscaleConfig
  cutContour: CutContour | null
  cutContourOffsetMm: number
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
  trimArtBackground: () => Promise<void>
  setBackgroundRemovalEnabled: (enabled: boolean) => Promise<void>
  setBackgroundRemovalRemoveHoles: (removeHoles: boolean) => Promise<void>
  setBorderEnabled: (enabled: boolean) => Promise<void>
  setBorderWidthMm: (widthMm: number) => Promise<void>
  setBorderColor: (color: string) => Promise<void>
  setUpscaleFactor: (factor: 2 | 3 | 4) => Promise<void>
  generateCutContour: () => Promise<void>
  clearCutContour: () => void
  setCutContourOffsetMm: (offsetMm: number) => void
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
    backgroundRemoval: { ...s.backgroundRemoval },
    border: { ...s.border },
    upscale: { ...s.upscale },
  }
}

type Get = () => MontagemState
type Set = (partial: Partial<MontagemState> | ((s: MontagemState) => Partial<MontagemState>)) => void

/**
 * Recalcula `art` a partir de `originalArt` + melhoria de definição (se
 * ligada) + remoção de fundo (se ligada) + borda (se ligada) + rotação —
 * ponto único por onde toda mudança que afeta a imagem final passa.
 * Reversível: desligar qualquer um desses passos volta exatamente ao estado
 * anterior, sem precisar reimportar o arquivo. Qualquer recálculo invalida
 * a linha de corte gerada (ela precisa ser gerada de novo sobre a imagem
 * atualizada).
 */
async function recomputeArt(get: Get, set: Set) {
  const { originalArt, rotation, backgroundRemoval, border, upscale } = get()
  if (!originalArt) {
    set({ art: null, cutContour: null })
    return
  }
  set({ loading: true, error: null })
  try {
    let base = originalArt
    if (upscale.enabled) {
      base = await upscaleImage(base, upscale.factor)
    }
    if (backgroundRemoval.enabled) {
      base = await removeBackgroundColor(base, { removeHoles: backgroundRemoval.removeHoles })
    }
    if (border.enabled) {
      base = await addBorderToArt(base, { widthMm: border.widthMm, color: border.color })
    }
    const final = rotation === 0 ? base : await rotateArt(base, rotation)
    set({ art: final, loading: false, cutContour: null })
  } catch (e) {
    set({ loading: false, error: e instanceof Error ? e.message : 'Falha ao processar a arte.' })
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
  backgroundRemoval: defaultBackgroundRemoval(),
  border: defaultBorder(),
  upscale: defaultUpscale(),
  cutContour: null,
  cutContourOffsetMm: 2,
  zoom: 1,
  loading: false,
  error: null,
  past: [],
  future: [],

  setArt: (art) => set({
    originalArt: art, art, rotation: 0,
    backgroundRemoval: defaultBackgroundRemoval(),
    border: defaultBorder(),
    upscale: defaultUpscale(),
    cutContour: null, error: null,
  }),

  clearArt: () => set({
    originalArt: null, art: null, rotation: 0,
    backgroundRemoval: defaultBackgroundRemoval(),
    border: defaultBorder(),
    upscale: defaultUpscale(),
    cutContour: null,
  }),

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
    const snap = snapshotOf(get())
    set({ rotation, past: [...get().past, snap], future: [] })
    await recomputeArt(get, set)
  },

  trimArtBackground: async () => {
    const { originalArt } = get()
    if (!originalArt) return
    set({ loading: true, error: null })
    try {
      const trimmed = await trimBackground(originalArt)
      set({ originalArt: trimmed, loading: false })
      await recomputeArt(get, set)
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Falha ao recortar o fundo da arte.' })
    }
  },

  setBackgroundRemovalEnabled: async (enabled) => {
    const snap = snapshotOf(get())
    set((s) => ({ backgroundRemoval: { ...s.backgroundRemoval, enabled }, past: [...s.past, snap], future: [] }))
    await recomputeArt(get, set)
  },

  setBackgroundRemovalRemoveHoles: async (removeHoles) => {
    const snap = snapshotOf(get())
    set((s) => ({ backgroundRemoval: { ...s.backgroundRemoval, removeHoles }, past: [...s.past, snap], future: [] }))
    if (get().backgroundRemoval.enabled) await recomputeArt(get, set)
  },

  setBorderEnabled: async (enabled) => {
    const snap = snapshotOf(get())
    set((s) => ({ border: { ...s.border, enabled }, past: [...s.past, snap], future: [] }))
    await recomputeArt(get, set)
  },

  setBorderWidthMm: async (widthMm) => {
    const snap = snapshotOf(get())
    set((s) => ({ border: { ...s.border, widthMm }, past: [...s.past, snap], future: [] }))
    if (get().border.enabled) await recomputeArt(get, set)
  },

  setBorderColor: async (color) => {
    const snap = snapshotOf(get())
    set((s) => ({ border: { ...s.border, color }, past: [...s.past, snap], future: [] }))
    if (get().border.enabled) await recomputeArt(get, set)
  },

  setUpscaleFactor: async (factor) => {
    const snap = snapshotOf(get())
    const current = get().upscale
    // Clicar no fator já ativo desmarca; clicar em outro fator ativa com esse fator.
    const enabled = !(current.enabled && current.factor === factor)
    set({ upscale: { enabled, factor }, past: [...get().past, snap], future: [] })
    await recomputeArt(get, set)
  },

  generateCutContour: async () => {
    const { art, cutContourOffsetMm, border } = get()
    if (!art) return
    set({ loading: true, error: null })
    try {
      // "Distância da arte" sempre conta a partir da arte ORIGINAL, não da
      // borda já adicionada — a borda entra como parte da silhueta que a
      // faca contorna, então só dilata além dela o que sobrar depois de
      // descontar a espessura da borda (ex: borda 2mm + distância 2mm =
      // faca exatamente na borda, 2mm da arte; não 4mm).
      const borderWidthMm = border.enabled ? border.widthMm : 0
      const effectiveOffsetMm = Math.max(0, cutContourOffsetMm - borderWidthMm)
      const contour = await generateCutContourForArt(art, effectiveOffsetMm)
      set({ cutContour: contour, loading: false })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Falha ao gerar a linha de corte.' })
    }
  },

  clearCutContour: () => set({ cutContour: null }),
  setCutContourOffsetMm: (offsetMm) => set({ cutContourOffsetMm: offsetMm }),

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
    void recomputeArt(get, set)
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
    void recomputeArt(get, set)
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
