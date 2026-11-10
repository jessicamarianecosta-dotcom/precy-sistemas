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

// ============================================================
// Criação de combinações em massa ("Modo B"): baixar modelo, preencher uma
// linha por combinação desejada (não precisa ser o produto cartesiano
// completo — só as combinações que serão vendidas de verdade) e importar.
//
// LIVRE: os cabeçalhos das colunas de variação são texto comum, editável —
// a pessoa escreve o nome do grupo que quiser (ex: Quantidade, Medida,
// Frente e verso, Acabamento) e os valores que quiser em cada linha; grupos
// e opções que ainda não existem no produto são CRIADOS automaticamente ao
// confirmar a importação (resolvido por nome/valor, nunca duplica um grupo
// ou opção que já existe — comparação sem diferenciar maiúsculas/minúsculas).
// Não precisa abrir a tela de Variações e cadastrar grupo por grupo antes.
// ============================================================

export const CREATE_SHEET_NAME = 'Novas combinações'
export const CREATE_COL_SEQ = 'Nº'
export const CREATE_COL_SKU = 'SKU'
export const CREATE_COL_STOCK = 'Estoque'
export const CREATE_COL_LEAD_TIME = 'Prazo (dias)'
export const CREATE_COL_WEIGHT = 'Peso (kg)'
export const CREATE_COL_PRICE = 'Preço-base'
const CREATE_ROWS = 200
/** Colunas de variação em branco oferecidas além das já existentes no produto — a pessoa renomeia o cabeçalho pra criar um grupo novo, ou apaga a coluna se não precisar. */
const CREATE_EXTRA_BLANK_GROUP_COLS = 6

/**
 * Monta o modelo de criação em massa: uma coluna de texto livre por grupo já
 * cadastrado no produto (cabeçalho = nome do grupo, editável) + algumas
 * colunas extras em branco para grupos novos, + SKU/Estoque/Prazo/Peso/
 * Preço-base. Sem dropdown/validação de lista de propósito — a pessoa pode
 * digitar uma opção que ainda não existe, e ela é criada ao importar. Não
 * grava nada — função pura.
 */
export function buildCreateVariantsWorkbook(opts: { productName: string; existingGroups: GroupRow[] }): ExcelJS.Workbook {
  const { productName, existingGroups } = opts
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Precy+'
  wb.created = new Date()

  const sheet = wb.addWorksheet(CREATE_SHEET_NAME, { views: [{ state: 'frozen', ySplit: 1 }] })
  const groupHeaders = [
    ...existingGroups.map(g => g.name),
    ...Array.from({ length: CREATE_EXTRA_BLANK_GROUP_COLS }, (_, i) => `Variação nova ${i + 1}`),
  ]
  const columns = [
    { header: CREATE_COL_SEQ, key: 'seq', width: 6 },
    ...groupHeaders.map((name, i) => ({ header: name, key: `col_${i}`, width: Math.max(18, name.length + 4) })),
    { header: CREATE_COL_SKU, key: 'sku', width: 14 },
    { header: CREATE_COL_STOCK, key: 'stock', width: 10 },
    { header: CREATE_COL_LEAD_TIME, key: 'lead', width: 12 },
    { header: CREATE_COL_WEIGHT, key: 'weight', width: 10 },
    { header: CREATE_COL_PRICE, key: 'price', width: 14 },
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

  const priceColIndex = columns.length
  for (let r = 2; r <= CREATE_ROWS + 1; r++) {
    const row = sheet.getRow(r)
    row.getCell(1).value = r - 1
    row.getCell(priceColIndex).numFmt = '#,##0.00'
    row.getCell(priceColIndex).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3D6' } }
    groupHeaders.forEach((_, gi) => {
      row.getCell(gi + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5EEE5' } }
    })
  }

  const info = wb.addWorksheet('Instruções')
  info.getColumn(1).width = 95
  info.addRows([
    [`Produto: ${productName}`],
    [''],
    ['Como preencher esta planilha'],
    ['1. Cada coluna de fundo rosa é um grupo de variação — o CABEÇALHO (primeira linha) é o nome do grupo. Pode renomear, apagar ou adicionar colunas livremente.'],
    ['2. Cada linha (abaixo do cabeçalho) é uma combinação nova. Escreva o valor da opção em cada grupo (ex: "500", "A4", "Fosco") e o preço-base.'],
    ['3. Grupo e opção que ainda não existirem no produto são criados automaticamente ao importar — não precisa cadastrar nada antes na tela de Variações.'],
    ['4. Deixe uma célula de grupo em branco se essa combinação não usa aquele grupo (ex: um "Extra" opcional que o cliente pode não querer).'],
    ['5. Não precisa preencher todas as linhas nem todas as combinações matematicamente possíveis — só as que você realmente vai vender.'],
    ['6. SKU, Estoque, Prazo e Peso são opcionais; deixe em branco para usar o padrão do produto.'],
    ['7. Salve o arquivo em .xlsx e importe pelo botão "Importar Excel (criar combinações)".'],
    ['8. Antes de confirmar, o sistema mostra uma prévia: quais grupos/opções são novos, quais combinações serão criadas, quais já existem (não duplica) e quais linhas têm erro — nada é salvo automaticamente.'],
  ])
  info.getRow(1).font = { bold: true, size: 13 }
  info.getRow(3).font = { bold: true }

  return wb
}

export interface CreateParsedRow {
  rowNumber: number
  /** Valor de texto digitado por grupo, na mesma ordem de `CreateParsedResult.groupNames` — '' = em branco. */
  valueByGroup: string[]
  sku: string | null
  stock: number | null
  leadTime: number | null
  weight: number | null
  price: number | null
  error: string | null
}
export interface CreateParsedResult {
  ok: boolean
  error?: string
  /** Nome de cada coluna de grupo (texto do cabeçalho, livre), na ordem das colunas da planilha. */
  groupNames: string[]
  rows: CreateParsedRow[]
}

/**
 * Lê o modelo preenchido. Qualquer coluna cujo cabeçalho não seja um dos
 * nomes fixos (Nº/SKU/Estoque/Prazo/Peso/Preço-base) e não esteja em branco
 * é tratada como grupo de variação, com o nome literal do cabeçalho — NÃO
 * resolve contra grupos/opções do banco aqui (isso depende do que já existe
 * no produto, feito por quem chama em .../criar-em-massa/analisar).
 */
export async function parseCreateVariantsWorkbook(buffer: ArrayBuffer | Buffer): Promise<CreateParsedResult> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buffer as any)
  } catch {
    return { ok: false, error: 'Arquivo inválido. Envie um arquivo .xlsx gerado pelo botão "Baixar modelo".', groupNames: [], rows: [] }
  }

  const sheet = wb.getWorksheet(CREATE_SHEET_NAME) ?? wb.worksheets[0]
  if (!sheet) return { ok: false, error: 'Planilha vazia ou sem abas.', groupNames: [], rows: [] }

  const headerRow = sheet.getRow(1)
  const groupCols: number[] = []
  const groupNames: string[] = []
  let priceCol = -1
  let skuCol = -1, stockCol = -1, leadCol = -1, weightCol = -1
  headerRow.eachCell((cell, colNumber) => {
    const label = String(cell.value ?? '').trim()
    if (label === CREATE_COL_PRICE) priceCol = colNumber
    else if (label === CREATE_COL_SKU) skuCol = colNumber
    else if (label === CREATE_COL_STOCK) stockCol = colNumber
    else if (label === CREATE_COL_LEAD_TIME) leadCol = colNumber
    else if (label === CREATE_COL_WEIGHT) weightCol = colNumber
    else if (label !== CREATE_COL_SEQ && label !== '') { groupCols.push(colNumber); groupNames.push(label) }
  })
  if (priceCol === -1) {
    return {
      ok: false,
      error: 'Esta planilha não tem a coluna "Preço-base". Baixe um modelo novo pelo botão "Baixar modelo" e preencha de novo.',
      groupNames: [], rows: [],
    }
  }
  if (groupCols.length === 0) {
    return {
      ok: false,
      error: 'Nenhuma coluna de grupo de variação foi encontrada — renomeie pelo menos uma das colunas em branco do modelo com o nome do grupo (ex: "Quantidade").',
      groupNames: [], rows: [],
    }
  }

  const rows: CreateParsedRow[] = []
  const lastRow = sheet.rowCount
  for (let r = 2; r <= lastRow; r++) {
    const row = sheet.getRow(r)
    const valueByGroup = groupCols.map(c => String(row.getCell(c).value ?? '').trim())
    const priceRaw = String(row.getCell(priceCol).value ?? '').trim()
    const skuRaw = skuCol !== -1 ? String(row.getCell(skuCol).value ?? '').trim() : ''
    const stockRaw = stockCol !== -1 ? String(row.getCell(stockCol).value ?? '').trim() : ''
    const leadRaw = leadCol !== -1 ? String(row.getCell(leadCol).value ?? '').trim() : ''
    const weightRaw = weightCol !== -1 ? String(row.getCell(weightCol).value ?? '').trim() : ''

    const rowHasData = valueByGroup.some(v => v !== '') || priceRaw !== ''
    if (!rowHasData) continue // linha em branco — ignora

    let error: string | null = null
    let price: number | null = null
    if (priceRaw === '') {
      error = 'Preço-base é obrigatório.'
    } else {
      const n = Number(priceRaw.replace(',', '.'))
      if (!Number.isFinite(n)) error = `Valor "${priceRaw}" não é um número válido na coluna "${CREATE_COL_PRICE}".`
      else if (n < 0) error = 'Preço negativo não é permitido.'
      else price = Math.round(n * 100) / 100
    }

    let stock: number | null = null
    if (!error && stockRaw !== '') {
      const n = Number(stockRaw.replace(',', '.'))
      if (!Number.isInteger(n) || n < 0) error = `Valor "${stockRaw}" inválido na coluna "${CREATE_COL_STOCK}".`
      else stock = n
    }
    let leadTime: number | null = null
    if (!error && leadRaw !== '') {
      const n = Number(leadRaw.replace(',', '.'))
      if (!Number.isInteger(n) || n < 0) error = `Valor "${leadRaw}" inválido na coluna "${CREATE_COL_LEAD_TIME}".`
      else leadTime = n
    }
    let weight: number | null = null
    if (!error && weightRaw !== '') {
      const n = Number(weightRaw.replace(',', '.'))
      if (!Number.isFinite(n) || n < 0) error = `Valor "${weightRaw}" inválido na coluna "${CREATE_COL_WEIGHT}".`
      else weight = Math.round(n * 1000) / 1000
    }

    rows.push({
      rowNumber: r, valueByGroup, sku: skuRaw || null, stock, leadTime, weight, price, error,
    })
  }

  return { ok: true, groupNames, rows }
}

export interface GroupPlanEntry {
  name: string
  /** null = grupo ainda não existe no produto — será criado ao confirmar. */
  existingId: string | null
  isRequired: boolean
  /** chave = valor em minúsculo/sem espaço nas pontas; existingId = null quando a opção ainda não existe. */
  options: Map<string, { value: string; existingId: string | null }>
}
export interface PlannedRow {
  rowNumber: number
  price: number
  sku: string | null
  stock: number | null
  leadTime: number | null
  weight: number | null
  /** Valor de texto (ou null = em branco) por grupo, na ordem de `PlanResult.groupsPlan`. */
  valueByFinalGroup: (string | null)[]
}
export interface PlanResult {
  ok: boolean
  error?: string
  groupsPlan: GroupPlanEntry[]
  rows: PlannedRow[]
  invalidRows: { row: number; reason: string }[]
}

/**
 * Reconcilia as colunas de grupo da planilha (nomes livres) com os grupos e
 * opções que o produto JÁ TEM — sem tocar no banco. Grupo/opção não
 * encontrado por nome/valor (comparação sem diferenciar maiúsculas/
 * minúsculas nem espaços nas pontas) entra no plano como "novo"
 * (existingId: null); quem chama decide se cria agora (confirmar) ou só
 * mostra na prévia (analisar) — a MESMA função roda nos dois passos, pra
 * nunca divergir entre o que a prévia mostra e o que é realmente criado.
 *
 * Um grupo novo (citado na planilha mas que ainda não existe) é
 * considerado opcional automaticamente se alguma linha preenchida deixou a
 * célula dele em branco — ninguém precisa configurar isso à parte. Um
 * grupo que o produto JÁ TEM e é obrigatório precisa aparecer como coluna
 * na planilha (erro claro se não aparecer) — do contrário não dá pra saber
 * que valor usar nele para as combinações novas.
 */
export function planCreateVariants(
  groupNames: string[],
  parsedRows: CreateParsedRow[],
  existingGroups: GroupRow[],
): PlanResult {
  const norm = (s: string) => s.trim().toLowerCase()

  const sheetColByNameLower = new Map<string, number>()
  groupNames.forEach((name, idx) => {
    const key = norm(name)
    if (!sheetColByNameLower.has(key)) sheetColByNameLower.set(key, idx)
  })

  const missingRequired = existingGroups.filter(g => g.is_required !== false && !sheetColByNameLower.has(norm(g.name)))
  if (missingRequired.length > 0) {
    return {
      ok: false,
      error: `Este produto já tem o(s) grupo(s) obrigatório(s) ${missingRequired.map(g => `"${g.name}"`).join(', ')} que não aparece(m) nesta planilha. Inclua uma coluna com esse nome exato, ou torne o grupo opcional na tela de Variações.`,
      groupsPlan: [], rows: [], invalidRows: [],
    }
  }

  // Ordem final: grupos já existentes primeiro (ordem atual do produto),
  // depois os grupos novos, na ordem de 1ª aparição entre as colunas da planilha.
  const groupsPlan: GroupPlanEntry[] = existingGroups.map(g => ({
    name: g.name,
    existingId: g.id,
    isRequired: g.is_required !== false,
    options: new Map(g.options.map(o => [norm(o.value), { value: o.value, existingId: o.id }])),
  }))
  const existingNamesLower = new Set(existingGroups.map(g => norm(g.name)))
  const seenNewNames = new Set<string>()
  for (const name of groupNames) {
    const key = norm(name)
    if (!existingNamesLower.has(key) && !seenNewNames.has(key)) {
      seenNewNames.add(key)
      groupsPlan.push({ name: name.trim(), existingId: null, isRequired: true, options: new Map() })
    }
  }

  const sheetColForFinalGroup = groupsPlan.map(g => sheetColByNameLower.get(norm(g.name)) ?? -1)

  const invalidRows: { row: number; reason: string }[] = []
  const rows: PlannedRow[] = []
  const newGroupHasBlank = new Set<string>() // nome(lower) de grupo novo com alguma linha em branco

  for (const r of parsedRows) {
    if (r.error) { invalidRows.push({ row: r.rowNumber, reason: r.error }); continue }
    if (r.price == null) { invalidRows.push({ row: r.rowNumber, reason: 'Preço-base é obrigatório.' }); continue }

    const valueByFinalGroup: (string | null)[] = groupsPlan.map((_, finalIdx) => {
      const col = sheetColForFinalGroup[finalIdx]
      if (col === -1) return null // grupo existente opcional, não citado na planilha
      const raw = r.valueByGroup[col]
      return raw === '' ? null : raw.trim()
    })

    groupsPlan.forEach((g, finalIdx) => {
      if (g.existingId === null && valueByFinalGroup[finalIdx] == null) newGroupHasBlank.add(norm(g.name))
    })

    rows.push({
      rowNumber: r.rowNumber, price: r.price, sku: r.sku, stock: r.stock, leadTime: r.leadTime, weight: r.weight,
      valueByFinalGroup,
    })
  }

  groupsPlan.forEach(g => {
    if (g.existingId === null && newGroupHasBlank.has(norm(g.name))) g.isRequired = false
  })

  for (const row of rows) {
    for (const [finalIdx, g] of groupsPlan.entries()) {
      if (g.isRequired && row.valueByFinalGroup[finalIdx] == null) {
        invalidRows.push({ row: row.rowNumber, reason: `Grupo "${g.name}" é obrigatório — preencha um valor.` })
        break
      }
    }
  }
  const invalidRowNumbers = new Set(invalidRows.map(r => r.row))
  const validRows = rows.filter(r => !invalidRowNumbers.has(r.rowNumber))

  for (const row of validRows) {
    groupsPlan.forEach((g, finalIdx) => {
      const val = row.valueByFinalGroup[finalIdx]
      if (val == null) return
      const key = norm(val)
      if (!g.options.has(key)) g.options.set(key, { value: val, existingId: null })
    })
  }

  return { ok: true, groupsPlan, rows: validRows, invalidRows }
}
