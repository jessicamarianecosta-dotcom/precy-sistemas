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
  // Editáveis diretamente na própria célula (ao contrário do preço, que usa
  // uma coluna "Novo X" separada por já ser o padrão conhecido) — qualquer
  // uma pode ser alterada e será comparada com o valor atual na importação.
  const editableColIndexes = ['status', 'sku', 'stock', 'lead', 'weight']
    .map(key => columns.findIndex(c => c.key === key) + 1)

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
    // Destaca visualmente as colunas editáveis.
    row.getCell(newPriceColIndex).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3D6' } }
    for (const colIdx of editableColIndexes) {
      row.getCell(colIdx).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3D6' } }
    }
    // "ID combinação" não deve ser editado — fonte levemente apagada deixa isso visualmente claro.
    row.getCell(idColIndex).font = { color: { argb: 'FFA8A29E' }, size: 9 }
  })

  const info = wb.addWorksheet('Instruções')
  info.getColumn(1).width = 95
  info.addRows([
    [`Produto: ${productName}`],
    [''],
    ['Como preencher esta planilha'],
    ['1. As colunas destacadas em amarelo são editáveis: Status, SKU, Estoque, Prazo (dias), Peso (kg) e Novo preço-base. Altere o que quiser mudar.'],
    ['2. Status, SKU, Estoque, Prazo e Peso: edite o valor diretamente na própria célula (ex: troque "4" por "6" em Prazo). O preço é a exceção — preencha a coluna separada "Novo preço-base"; "Preço-base atual" é só para conferência.'],
    ['3. Status aceita apenas "Ativa" ou "Inativa".'],
    ['4. Deixe uma célula em branco para NÃO alterar aquele campo — célula vazia nunca apaga uma informação já cadastrada.'],
    ['5. Não altere a coluna "ID combinação (não alterar)" — é ela que identifica cada combinação ao importar de volta, não o nome nem a posição da linha.'],
    ['6. Não adicione nem remova linhas, e não altere os nomes das colunas de variação (Capa, Papel etc.) — elas são só para conferência; para renomear uma opção, use a tela de variações do produto.'],
    ['7. Os acréscimos/descontos fixos e percentuais já configurados em cada opção continuam sendo aplicados automaticamente sobre o novo preço-base — não é preciso recalculá-los aqui.'],
    ['8. Salve o arquivo em formato .xlsx e volte ao Precy+ para importar pelo botão "Importar Excel".'],
    ['9. Antes de confirmar, o sistema mostra uma prévia campo a campo de tudo que será alterado — nada é salvo automaticamente.'],
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
  /** Campos extras editados diretamente na célula — chave ausente = célula vazia, não altera. */
  hasStatus: boolean
  status: boolean | null // is_active
  hasSku: boolean
  sku: string | null
  hasStock: boolean
  stock: number | null
  hasLeadTime: boolean
  leadTime: number | null
  hasWeight: boolean
  weight: number | null
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
  let statusCol = -1
  let skuCol = -1
  let stockCol = -1
  let leadCol = -1
  let weightCol = -1
  headerRow.eachCell((cell, colNumber) => {
    const label = String(cell.value ?? '').trim()
    if (label === COL_ID) idCol = colNumber
    if (label === COL_NEW_PRICE) priceCol = colNumber
    if (label === COL_STATUS) statusCol = colNumber
    if (label === COL_SKU) skuCol = colNumber
    if (label === COL_STOCK) stockCol = colNumber
    if (label === COL_LEAD_TIME) leadCol = colNumber
    if (label === COL_WEIGHT) weightCol = colNumber
  })
  if (idCol === -1 || priceCol === -1) {
    return {
      ok: false,
      error: 'Esta planilha não tem a estrutura esperada pelo Precy+. Baixe uma nova planilha pelo botão "Exportar Excel".',
      rows: [],
    }
  }
  // statusCol/skuCol/etc. podem estar ausentes numa planilha exportada antes
  // dessa versão — segue funcionando, só sem ler esses campos (equivalente a
  // deixá-los sempre em branco: nenhum é alterado).

  const rows: ParsedImportRow[] = []
  const lastRow = sheet.rowCount
  for (let r = 2; r <= lastRow; r++) {
    const row = sheet.getRow(r)
    const idCellValue = row.getCell(idCol).value
    const idStr = idCellValue != null ? String(idCellValue).trim() : ''
    if (!idStr) continue // linha em branco — ignora

    let error: string | null = null

    const priceCellValue = row.getCell(priceCol).value
    const priceRaw = priceCellValue != null ? String(priceCellValue).trim() : ''
    const hasNewPrice = priceRaw !== ''
    let newPrice: number | null = null
    if (hasNewPrice) {
      const n = typeof priceCellValue === 'number' ? priceCellValue : Number(priceRaw.replace(',', '.'))
      if (!Number.isFinite(n)) error = error ?? `Valor "${priceRaw}" não é um número válido na coluna "${COL_NEW_PRICE}".`
      else if (n < 0) error = error ?? 'Preço negativo não é permitido.'
      else newPrice = Math.round(n * 100) / 100
    }

    let hasStatus = false
    let status: boolean | null = null
    if (statusCol !== -1) {
      const raw = String(row.getCell(statusCol).value ?? '').trim()
      if (raw !== '') {
        hasStatus = true
        const norm = raw.toLowerCase()
        if (norm === 'ativa') status = true
        else if (norm === 'inativa') status = false
        else error = error ?? `Valor "${raw}" inválido na coluna "${COL_STATUS}" — use "Ativa" ou "Inativa".`
      }
    }

    let hasSku = false
    let sku: string | null = null
    if (skuCol !== -1) {
      const raw = String(row.getCell(skuCol).value ?? '').trim()
      if (raw !== '') { hasSku = true; sku = raw }
    }

    let hasStock = false
    let stock: number | null = null
    if (stockCol !== -1) {
      const raw = String(row.getCell(stockCol).value ?? '').trim()
      if (raw !== '') {
        hasStock = true
        const n = Number(raw.replace(',', '.'))
        if (!Number.isInteger(n) || n < 0) error = error ?? `Valor "${raw}" inválido na coluna "${COL_STOCK}" — use um número inteiro igual ou maior que 0.`
        else stock = n
      }
    }

    let hasLeadTime = false
    let leadTime: number | null = null
    if (leadCol !== -1) {
      const raw = String(row.getCell(leadCol).value ?? '').trim()
      if (raw !== '') {
        hasLeadTime = true
        const n = Number(raw.replace(',', '.'))
        if (!Number.isInteger(n) || n < 0) error = error ?? `Valor "${raw}" inválido na coluna "${COL_LEAD_TIME}" — use um número inteiro igual ou maior que 0.`
        else leadTime = n
      }
    }

    let hasWeight = false
    let weight: number | null = null
    if (weightCol !== -1) {
      const raw = String(row.getCell(weightCol).value ?? '').trim()
      if (raw !== '') {
        hasWeight = true
        const n = Number(raw.replace(',', '.'))
        if (!Number.isFinite(n) || n < 0) error = error ?? `Valor "${raw}" inválido na coluna "${COL_WEIGHT}" — use um número igual ou maior que 0.`
        else weight = Math.round(n * 1000) / 1000
      }
    }

    rows.push({
      rowNumber: r, id: idStr, hasNewPrice, newPrice,
      hasStatus, status, hasSku, sku, hasStock, stock, hasLeadTime, leadTime, hasWeight, weight,
      error,
    })
  }

  return { ok: true, rows }
}
