import { describe, expect, it } from 'vitest'
import { bestRollPacking, bestSheetPacking, computeRollPacking, computeSheetPacking, fitCount, packBobina, packFolha, singleItemResult, spaceForCount, tightenRollLength, tightenRollWidth } from './packing'
import type { BobinaConfig, FolhaConfig } from './types'

const NO_MARGIN = { top: 0, right: 0, bottom: 0, left: 0 }

describe('fitCount', () => {
  it('encaixa exatamente quando o espaço é múltiplo exato', () => {
    // 10 itens de 10mm + 9 espaços de 2mm = 118mm
    expect(fitCount(118, 10, 2)).toBe(10)
    expect(fitCount(117.9, 10, 2)).toBe(9)
  })

  it('retorna 0 quando o item não cabe', () => {
    expect(fitCount(5, 10, 0)).toBe(0)
  })
})

describe('Teste 1 — Bobina de adesivo (120 × 30 cm, adesivo 4 × 4 cm, espaçamento 2 mm)', () => {
  const input = {
    rollWidthMm: 1200,
    itemWidthMm: 40,
    itemHeightMm: 40,
    margins: NO_MARGIN,
    spacing: { x: 2, y: 2 },
    rollLengthMm: 300 as number | null,
    desiredQty: null as number | null,
  }

  it('calcula colunas, linhas, total e aproveitamento', () => {
    const result = computeRollPacking({ ...input, rotate: false })
    // largura útil 1200mm: floor((1200+2)/(40+2)) = floor(28.6) = 28
    expect(result.cols).toBe(28)
    // comprimento útil 300mm: floor((300+2)/(40+2)) = floor(7.19) = 7
    expect(result.rows).toBe(7)
    expect(result.total).toBe(196)
    expect(result.fits).toBe(true)

    const usedArea = 196 * 40 * 40 // mm²
    expect(result.usedAreaMm2).toBe(usedArea)
    expect(result.totalAreaMm2).toBe(1200 * 300)
    expect(result.wasteAreaMm2).toBeCloseTo(1200 * 300 - usedArea, 5)
    expect(result.utilizationPct).toBeCloseTo((usedArea / (1200 * 300)) * 100, 5)
  })

  it('quadrado 4×4 cm: girar 90° não muda o resultado (mesma área)', () => {
    const comparison = bestRollPacking(input)
    expect(comparison.normal.total).toBe(comparison.rotated.total)
    expect(comparison.best.total).toBe(196)
  })

  it('calcula o comprimento de bobina necessário para uma quantidade desejada', () => {
    const result = computeRollPacking({ ...input, rollLengthMm: null, desiredQty: 500, rotate: false })
    // 28 colunas, 500/28 = 17.86 → 18 linhas
    expect(result.cols).toBe(28)
    expect(result.rows).toBe(18)
    expect(result.total).toBe(504) // arredonda para linhas cheias
    // comprimento: 18*40 + 17*2 = 720 + 34 = 754mm
    expect(result.lengthNeededMm).toBe(754)
  })

  it('packBobina aplica override manual válido', () => {
    const config: BobinaConfig = {
      rollWidthMm: 1200, rollLengthMm: 300, desiredQty: null,
      margins: NO_MARGIN, spacing: { x: 2, y: 2 },
      manualCols: 20, manualRows: 5,
    }
    const comparison = packBobina(config, 40, 40)
    expect(comparison.best.fits).toBe(true)
    expect(comparison.best.total).toBe(100)
    expect(comparison.best.manual).toBe(true)
  })

  it('packBobina rejeita override manual que não cabe fisicamente', () => {
    const config: BobinaConfig = {
      rollWidthMm: 1200, rollLengthMm: 300, desiredQty: null,
      margins: NO_MARGIN, spacing: { x: 2, y: 2 },
      manualCols: 40, manualRows: 5,
    }
    const comparison = packBobina(config, 40, 40)
    expect(comparison.best.fits).toBe(false)
    expect(comparison.best.reason).toBeTruthy()
  })
})

describe('Teste 2 — Folha A4 (cartão 9 × 5 cm, margens 2 cm, espaçamento 1 cm)', () => {
  const margins = { top: 20, right: 20, bottom: 20, left: 20 }
  const spacing = { x: 10, y: 10 }

  it('orientação normal (cartão na horizontal, 90×50mm)', () => {
    const result = computeSheetPacking({
      sheetWidthMm: 210, sheetHeightMm: 297,
      itemWidthMm: 90, itemHeightMm: 50,
      margins, spacing, rotate: false,
    })
    // largura útil: 210-40=170mm → floor((170+10)/(90+10))=1
    expect(result.cols).toBe(1)
    // altura útil: 297-40=257mm → floor((257+10)/(50+10))=4
    expect(result.rows).toBe(4)
    expect(result.total).toBe(4)
  })

  it('orientação rotacionada (cartão na vertical, 50×90mm) aproveita melhor', () => {
    const result = computeSheetPacking({
      sheetWidthMm: 210, sheetHeightMm: 297,
      itemWidthMm: 90, itemHeightMm: 50,
      margins, spacing, rotate: true,
    })
    // largura útil 170mm, item 50mm: floor((170+10)/(50+10))=3
    expect(result.cols).toBe(3)
    // altura útil 257mm, item 90mm: floor((257+10)/(90+10))=2
    expect(result.rows).toBe(2)
    expect(result.total).toBe(6)
  })

  it('bestSheetPacking escolhe a orientação rotacionada por ter mais unidades', () => {
    const comparison = bestSheetPacking({
      sheetWidthMm: 210, sheetHeightMm: 297,
      itemWidthMm: 90, itemHeightMm: 50,
      margins, spacing,
    })
    expect(comparison.normal.total).toBe(4)
    expect(comparison.rotated.total).toBe(6)
    expect(comparison.best.total).toBe(6)
    expect(comparison.best.rotated).toBe(true)
  })

  it('packFolha com preset A4 e override manual inválido impede montagem', () => {
    const config: FolhaConfig = {
      preset: 'A4', sheetWidthMm: 210, sheetHeightMm: 297,
      margins, spacing, desiredQty: null,
      manualCols: 10, manualRows: 10,
    }
    // dimensões já na orientação vertical (50x90) — equivalente a ter girado a arte de verdade
    const comparison = packFolha(config, 50, 90)
    expect(comparison.best.fits).toBe(false)
  })
})

describe('spaceForCount', () => {
  it('calcula o espaço físico ocupado por N itens com espaçamento entre eles', () => {
    expect(spaceForCount(5, 10, 2)).toBe(5 * 10 + 4 * 2)
    expect(spaceForCount(1, 10, 2)).toBe(10)
    expect(spaceForCount(0, 10, 2)).toBe(0)
  })
})

describe('tightenRollLength', () => {
  it('corta o comprimento sobrando quando o informado é maior que o necessário', () => {
    // Bobina de 120cm largura x 50cm comprimento informado, adesivo 4x4cm, espaçamento 2mm, sem margem.
    const result = computeRollPacking({
      rollWidthMm: 1200, itemWidthMm: 40, itemHeightMm: 40,
      margins: NO_MARGIN, spacing: { x: 2, y: 2 },
      rollLengthMm: 500, desiredQty: null, rotate: false,
    })
    // 500mm de comprimento cabem floor((500+2)/42)=11 linhas (462mm usados), sobrando 38mm.
    expect(result.rows).toBe(11)
    expect(result.containerHeightMm).toBe(500)

    const tightened = tightenRollLength(result, 0, 0, 2)
    expect(tightened.containerHeightMm).toBeCloseTo(spaceForCount(11, 40, 2), 5)
    expect(tightened.containerHeightMm).toBeLessThan(500)
    // Não mexe na largura.
    expect(tightened.containerWidthMm).toBe(1200)
    // Área/aproveitamento recalculados para o novo tamanho (sem a sobra).
    expect(tightened.utilizationPct).toBeGreaterThan(result.utilizationPct)
  })

  it('não altera quando o comprimento informado já é exatamente o necessário', () => {
    // 7 linhas de 40mm com 6 espaços de 2mm = 292mm exatos, sem sobra.
    const result = computeRollPacking({
      rollWidthMm: 1200, itemWidthMm: 40, itemHeightMm: 40,
      margins: NO_MARGIN, spacing: { x: 2, y: 2 },
      rollLengthMm: 292, desiredQty: null, rotate: false,
    })
    expect(result.rows).toBe(7)
    const tightened = tightenRollLength(result, 0, 0, 2)
    expect(tightened.containerHeightMm).toBe(result.containerHeightMm)
  })

  it('não mexe num resultado que não encaixa', () => {
    const result = computeRollPacking({
      rollWidthMm: 10, itemWidthMm: 40, itemHeightMm: 40,
      margins: NO_MARGIN, spacing: { x: 2, y: 2 },
      rollLengthMm: 500, desiredQty: null, rotate: false,
    })
    expect(result.fits).toBe(false)
    const tightened = tightenRollLength(result, 0, 0, 2)
    expect(tightened).toEqual(result)
  })
})

describe('tightenRollWidth', () => {
  it('corta a largura sobrando quando a informada é maior que a necessária', () => {
    // Bobina de 120cm de largura, adesivo 4x4cm, espaçamento 2mm, sem margem:
    // 28 colunas de 40mm + 27 espaços de 2mm = 1174mm usados, sobrando 26mm.
    const result = computeRollPacking({
      rollWidthMm: 1200, itemWidthMm: 40, itemHeightMm: 40,
      margins: NO_MARGIN, spacing: { x: 2, y: 2 },
      rollLengthMm: 300, desiredQty: null, rotate: false,
    })
    expect(result.cols).toBe(28)
    expect(result.containerWidthMm).toBe(1200)

    const tightened = tightenRollWidth(result, 0, 0, 2)
    expect(tightened.containerWidthMm).toBeCloseTo(spaceForCount(28, 40, 2), 5)
    expect(tightened.containerWidthMm).toBeLessThan(1200)
    // Não mexe no comprimento.
    expect(tightened.containerHeightMm).toBe(300)
    expect(tightened.utilizationPct).toBeGreaterThan(result.utilizationPct)
  })

  it('não altera quando a largura informada já é exatamente a necessária', () => {
    // 5 colunas de 40mm com 4 espaços de 2mm = 208mm exatos, sem sobra.
    const result = computeRollPacking({
      rollWidthMm: 208, itemWidthMm: 40, itemHeightMm: 40,
      margins: NO_MARGIN, spacing: { x: 2, y: 2 },
      rollLengthMm: 300, desiredQty: null, rotate: false,
    })
    expect(result.cols).toBe(5)
    const tightened = tightenRollWidth(result, 0, 0, 2)
    expect(tightened.containerWidthMm).toBe(result.containerWidthMm)
  })

  it('não mexe num resultado que não encaixa', () => {
    const result = computeRollPacking({
      rollWidthMm: 1200, itemWidthMm: 40, itemHeightMm: 40,
      margins: NO_MARGIN, spacing: { x: 2, y: 2 },
      rollLengthMm: 1, desiredQty: null, rotate: false,
    })
    expect(result.fits).toBe(false)
    const tightened = tightenRollWidth(result, 0, 0, 2)
    expect(tightened).toEqual(result)
  })
})

describe('singleItemResult', () => {
  it('monta um resultado de 1×1 do tamanho exato da arte, sem sobra', () => {
    const result = singleItemResult(90, 50)
    expect(result.cols).toBe(1)
    expect(result.rows).toBe(1)
    expect(result.total).toBe(1)
    expect(result.containerWidthMm).toBe(90)
    expect(result.containerHeightMm).toBe(50)
    expect(result.usedAreaMm2).toBe(90 * 50)
    expect(result.wasteAreaMm2).toBe(0)
    expect(result.utilizationPct).toBe(100)
    expect(result.fits).toBe(true)
  })
})
