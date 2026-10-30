import ExcelJS from 'exceljs'
import { calcOptionsAdjustment, type OptionPriceAdjustment } from '@/lib/produtos/variantPricing'
import type { GroupRow } from './variationCombos'

/**
 * Exportação/importação de variações em Excel (Produtos → Variações →
 * Exportar/Importar Excel). Formato e nomes de coluna compartilhados entre
 * geração (app/api/produtos/variacoes/exportar) e leitura (.../importar/
 * analisar), pra nunca ficarem fora de sincronia.
 */

export const SHEET_NAME = 'Combinações'
export const COL_SEQ = 'Nº'
export const COL_ID = 'ID combinação (não alterar)'
export const COL_STATUS = 'Status'
export const COL_SKU = 'SKU'
export const COL_STOCK = 'Estoque'
export const COL_LEAD_TIME = 'Prazo (dias)'
export const COL_WEIGHT = 'Peso (kg)'
export const COL_IMAGE = 'Imagem'
export const COL_ADJ_FIXED = 'Acréscimo fixo (R$)'
export const COL_ADJ_PERCENT = 'Acréscimo percentual (%)'
export const COL_CURRENT_BASE = 'Preço-base atual'
export const COL_CURRENT_FINAL = 'Preço final atual'
export const COL_NEW_PRICE = 'Novo preço-base'

const round2 = (v: number) => Math.round(v * 100) / 100

export interface ExportVariantRow {
  id: string
  /** option id selecionado em cada grupo, na mesma ordem do array `groups`. */
  optionIdsByGroup: (string | null | undefined)[]
  is_active: boolean
  sku: string | null
  stock_quantity: number | null
  lead_time_days: number | null
  weight_kg: number | null
  /** Rótulo legível da imagem (ex: "Foto 2" ou "Padrão"), já resolvido pelo chamador. */
  image_label: string
  /** Preço-base próprio da combinação; null = usa o preço do produto (fallback). */
  price: number | null
}

function groupKey(groupId: string) {
  return `group_${groupId}`
}

/** Monta o workbook de exportação. Não lê nem grava nada — função pura. */
export function buildVariantsWorkbook(opts: {
  productName: string
  productPrice: number
  groups: GroupRow[]
  rows: ExportVariantRow[]
}): ExcelJS.Workbook {
  const { productName, productPrice, groups, rows } = opts
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Precy+'
  wb.created = new Date()

  const sheet = wb.addWorksheet(SHEET_NAME, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  const columns = [
    { header: COL_SEQ, key: 'seq', width: 6 },
    { header: COL_ID, key: 'id', width: 38 },
    ...groups.map(g => ({ header: g.name, key: groupKey(g.id), width: Math.max(14, g.name.length + 2) })),
    { header: COL_STATUS, key: 'status', width: 10 },
    { header: COL_SKU, key: 'sku', width: 14 },
    { header: COL_STOCK, key: 'stock', width: 10 },
    { header: COL_LEAD_TIME, key: 'lead', width: 12 },
    { header: COL_WEIGHT, key: 'weight', width: 10 },
    { header: COL_IMAGE, key: 'image', width: 14 },
    { header: COL_ADJ_FIXED, key: 'adjFixed', width: 16 },
    { header: COL_ADJ_PERCENT, key: 'adjPercent', width: 18 },
    { header: COL_CURRENT_BASE, key: 'currentBase', width: 15 },
    { header: COL_CURRENT_FINAL, key: 'currentFinal', width: 15 },
    { header: COL_NEW_PRICE, key: 'newBase', width: 16 },
  ]
  sheet.columns = columns as ExcelJS.Column[]

  const headerRow = sheet.getRow(1)
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B6C4F' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
  headerRow.height = 26
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }

  const newPriceColIndex = columns.length
  const currentBaseColIndex = columns.findIndex(c => c.key === 'currentBase') + 1
  const currentFinalColIndex = columns.findIndex(c => c.key === 'currentFinal') + 1
  const adjFixedColIndex = columns.findIndex(c => c.key === 'adjFixed') + 1
  const idColIndex = columns.findIndex(c => c.key === 'id') + 1

  rows.forEach((v, i) => {
    const optionsForAdj: (OptionPriceAdjustment | null | undefined)[] = groups.map((g, idx) =>
      g.options.find(o => o.id === v.optionIdsByGroup[idx])
    )
    const basePrice = v.price ?? productPrice
    const adj = calcOptionsAdjustment(basePrice, optionsForAdj)

    const rowData: Record<string, unknown> = {
      seq: i + 1,
      id: v.id,
      status: v.is_active ? 'Ativa' : 'Inativa',
      sku: v.sku ?? '',
      stock: v.stock_quantity ?? '',
      lead: v.lead_time_days ?? '',
      weight: v.weight_kg ?? '',
      image: v.image_label,
      adjFixed: adj.fixedTotal,
      adjPercent: adj.percentTotal,
      currentBase: round2(basePrice),
      currentFinal: adj.finalPrice,
      newBase: null,
    }
    groups.forEach((g, idx) => {
      const opt = g.options.find(o => o.id === v.optionIdsByGroup[idx])
      rowData[groupKey(g.id)] = opt?.value ?? ''
    })

    const row = sheet.addRow(rowData)
    row.getCell(currentBaseColIndex).numFmt = '#,##0.00'
    row.getCell(currentFinalColIndex).numFmt = '#,##0.00'
    row.getCell(adjFixedColIndex).numFmt = '#,##0.00'
    row.getCell(newPriceColIndex).numFmt = '#,##0.00'
    // Destaca visualmente a única coluna editável.
    row.getCell(newPriceColIndex).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3D6' } }
    // "ID combinação" não deve ser editado — fonte levemente apagada deixa isso visualmente claro.
    row.getCell(idColIndex).font = { color: { argb: 'FFA8A29E' }, size: 9 }
  })

  const info = wb.addWorksheet('Instruções')
  info.getColumn(1).width = 95
  info.addRows([
    [`Produto: ${productName}`],
    [''],
    ['Como preencher esta planilha'],
    ['1. Preencha apenas a coluna "Novo preço-base" (última coluna, destacada em amarelo) com o novo valor para cada combinação.'],
    ['2. Deixe em branco as combinações que não devem mudar de preço — elas não serão alteradas.'],
    ['3. Não altere a coluna "ID combinação (não alterar)" — é ela que identifica cada combinação ao importar de volta, não o nome.'],
    ['4. Não adicione nem remova linhas, e não altere os dados das outras colunas — elas são só para conferência.'],
    ['5. Os acréscimos/descontos fixos e percentuais já configurados em cada opção continuam sendo aplicados automaticamente sobre o novo preço-base — não é preciso recalculá-los aqui.'],
    ['6. Salve o arquivo em formato .xlsx e volte ao Precy+ para importar pelo botão "Importar Excel".'],
    ['7. Antes de confirmar, o sistema mostra uma prévia de tudo que será alterado — nada é salvo automaticamente.'],
  ])
  info.getRow(1).font = { bold: true, size: 13 }
  info.getRow(3).font = { bold: true }

  return wb
}

export interface ParsedImportRow {
  /** Número da linha na planilha (1 = cabeçalho), pra apontar erros de forma legível. */
  rowNumber: number
  id: string
  hasNewPrice: boolean
  /** Preço já validado e arredondado; null se a célula estava vazia ou inválida. */
  newPrice: number | null
  /** Erro de leitura desta linha (valor não numérico, negativo, id ausente) — nulo se ok. */
  error: string | null
}

export interface ParsedWorkbookResult {
  ok: boolean
  /** Presente só quando ok=false — arquivo ilegível ou estrutura incompatível. */
  error?: string
  rows: ParsedImportRow[]
}

/**
 * Lê um arquivo .xlsx (buffer) gerado por buildVariantsWorkbook e devolve as
 * linhas com dados, já com validação de formato por linha (não numérico,
 * negativo). Não cruza com o banco — isso é feito por quem chama, que tem o
 * productId e os dados atuais das combinações.
 */
export async function parseVariantsWorkbook(buffer: ArrayBuffer | Buffer): Promise<ParsedWorkbookResult> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buffer as any)
  } catch {
    return { ok: false, error: 'Arquivo inválido. Envie um arquivo .xlsx gerado pelo botão "Exportar Excel".', rows: [] }
  }

  const sheet = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets[0]
  if (!sheet) return { ok: false, error: 'Planilha vazia ou sem abas.', rows: [] }

  const headerRow = sheet.getRow(1)
  let idCol = -1
  let priceCol = -1
  headerRow.eachCell((cell, colNumber) => {
    const label = String(cell.value ?? '').trim()
    if (label === COL_ID) idCol = colNumber
    if (label === COL_NEW_PRICE) priceCol = colNumber
  })
  if (idCol === -1 || priceCol === -1) {
    return {
      ok: false,
      error: 'Esta planilha não tem a estrutura esperada pelo Precy+. Baixe uma nova planilha pelo botão "Exportar Excel" e preencha só a coluna "Novo preço-base".',
      rows: [],
    }
  }

  const rows: ParsedImportRow[] = []
  const lastRow = sheet.rowCount
  for (let r = 2; r <= lastRow; r++) {
    const row = sheet.getRow(r)
    const idCellValue = row.getCell(idCol).value
    const idStr = idCellValue != null ? String(idCellValue).trim() : ''
    if (!idStr) continue // linha em branco — ignora

    const priceCellValue = row.getCell(priceCol).value
    const rawStr = priceCellValue != null ? String(priceCellValue).trim() : ''
    const hasNewPrice = rawStr !== ''
    let newPrice: number | null = null
    let error: string | null = null
    if (hasNewPrice) {
      const n = typeof priceCellValue === 'number' ? priceCellValue : Number(rawStr.replace(',', '.'))
      if (!Number.isFinite(n)) error = `Valor "${rawStr}" não é um número válido na coluna "${COL_NEW_PRICE}".`
      else if (n < 0) error = 'Preço negativo não é permitido.'
      else newPrice = Math.round(n * 100) / 100
    }
    rows.push({ rowNumber: r, id: idStr, hasNewPrice, newPrice, error })
  }

  return { ok: true, rows }
}
