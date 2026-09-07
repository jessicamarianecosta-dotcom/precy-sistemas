/**
 * Extração genérica de "produto de catálogo em PDF" a partir do texto já
 * extraído do arquivo (ver lib/pdf/extractCatalogPdfText.ts, que roda no
 * client). Deliberadamente sem nada específico da LumiLife: hoje importamos
 * o catálogo dela, no futuro outros catálogos passam pelo mesmo pipeline
 * (PDF → extração → normalização → revisão → mapeamento → importação).
 *
 * Regra de ouro: nunca inventar dado. Quando o texto não deixa claro um
 * campo, ele fica null/vazio e o item é marcado para revisão — quem decide
 * o que fazer é a pessoa na tela de pré-visualização, não o parser.
 */

export interface ParsedCatalogItem {
  tempId: string
  name: string
  category: string | null
  price: number | null
  priceRaw: string | null
  unit: string | null
  minQuantity: number | null
  notes: string | null
  needsReview: boolean
  reviewReasons: string[]
}

const PRICE_RE = /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{2})?)/
const MIN_QTY_RE = /m[íi]n(?:imo)?\.?\s*(?:de\s*)?(\d+)\s*(un(?:id(?:ades?)?)?|pe[çc]as?|kg|m²?|cx|caixas?)?/i
const UNIT_HINT_RE = /\b(un(?:id(?:ades?)?)?|pç|peça|kg|m²|caixa|cx|kit|par|dz|dúzia)\b/i
const BULLET_RE = /^[\s•\-–*·►▪]+/
const NUMBERING_RE = /^\d+[.)]\s+/

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function normalizeForMatch(name: string): string {
  return stripAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function parsePriceToNumber(raw: string): number {
  // "1.234,56" (BR) ou "12,50" ou "12.50" — nunca arredondar, só normalizar
  // separador decimal para Number().
  const hasComma = raw.includes(',')
  const cleaned = hasComma ? raw.replace(/\./g, '').replace(',', '.') : raw
  return Number(cleaned)
}

function looksLikeCategoryHeader(line: string): boolean {
  if (line.length === 0 || line.length > 45) return false
  if (PRICE_RE.test(line)) return false
  if (/\d{2,}/.test(line)) return false // datas, códigos, medidas soltas
  const letters = line.replace(/[^a-zA-ZÀ-ÿ]/g, '')
  return letters.length >= 3
}

function cleanName(raw: string): string {
  return raw
    .replace(BULLET_RE, '')
    .replace(NUMBERING_RE, '')
    .replace(/[-–:]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function parseCatalogText(rawText: string, maxItems = 500): ParsedCatalogItem[] {
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0)

  const items: ParsedCatalogItem[] = []
  let currentCategory: string | null = null
  let seq = 0
  let lastKey = ''

  for (let i = 0; i < lines.length && items.length < maxItems; i++) {
    const line = lines[i]
    const next = lines[i + 1]

    // Cabeçalho de categoria: linha curta sem preço, seguida (em até 2
    // linhas) por algo que parece produto (tem preço) — nunca inventa
    // categoria nova sem indício no próprio texto.
    if (looksLikeCategoryHeader(line) && next) {
      const nextHasPrice = PRICE_RE.test(next)
      const nextNextHasPrice = lines[i + 2] ? PRICE_RE.test(lines[i + 2]) : false
      if (nextHasPrice || nextNextHasPrice) {
        currentCategory = cleanName(line)
        continue
      }
    }

    const priceMatch = line.match(PRICE_RE)
    let sourceLine = line
    let mergedFromNext = false

    // Preço numa linha própria (tabela quebrada em várias linhas): junta com
    // o nome da linha anterior já processada como candidata a produto.
    if (!priceMatch && /^R\$\s*[\d.,]+\s*$/.test(line) === false && next && /^R\$\s*[\d.,]+\s*$/.test(next)) {
      sourceLine = `${line} ${next}`
      mergedFromNext = true
    }

    const finalPriceMatch = sourceLine.match(PRICE_RE)
    if (!finalPriceMatch) continue // sem preço identificável nesta linha: não é candidato a produto

    const priceRaw = finalPriceMatch[0]
    const price = parsePriceToNumber(finalPriceMatch[1])

    const minQtyMatch = sourceLine.match(MIN_QTY_RE)
    const minQuantity = minQtyMatch ? Number(minQtyMatch[1]) : null

    const unitHintMatch = sourceLine.match(UNIT_HINT_RE)
    const unit = unitHintMatch ? unitHintMatch[1].toLowerCase() : null

    let namePart = sourceLine
      .replace(finalPriceMatch[0], '')
      .replace(minQtyMatch?.[0] ?? '', '')
      .trim()
    namePart = cleanName(namePart)

    if (mergedFromNext) i++ // consome a linha do preço já incorporada

    const reviewReasons: string[] = []
    let name = namePart
    if (!name || name.length < 2 || /^\d+$/.test(name)) {
      name = 'Não identificado'
      reviewReasons.push('Nome não identificado')
    }
    if (!Number.isFinite(price) || price <= 0) {
      reviewReasons.push('Preço não identificado')
    }

    const key = `${normalizeForMatch(name)}|${priceRaw}`
    if (key === lastKey) continue // linha repetida (cabeçalho/rodapé de página)
    lastKey = key

    items.push({
      tempId: `item-${seq++}`,
      name,
      category: currentCategory,
      price: Number.isFinite(price) && price > 0 ? price : null,
      priceRaw,
      unit,
      minQuantity,
      notes: null,
      needsReview: reviewReasons.length > 0,
      reviewReasons,
    })
  }

  return items
}
