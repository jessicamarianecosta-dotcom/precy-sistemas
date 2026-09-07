/**
 * Extração ESTRUTURAL de "produto de catálogo em PDF" a partir das linhas já
 * posicionadas do arquivo (ver lib/pdf/extractCatalogPdfText.ts, que roda no
 * client e já descarta cabeçalho/rodapé por geometria). Deliberadamente sem
 * nada específico da LumiLife: hoje importamos o catálogo dela, no futuro
 * outros catálogos passam pelo mesmo pipeline (PDF → extração → estrutura de
 * página → blocos candidatos → normalização → revisão → mapeamento →
 * importação).
 *
 * Diferença central da primeira versão (que tratava qualquer linha com
 * preço como produto): aqui um "produto" só existe quando várias linhas
 * PRÓXIMAS na página (um bloco) contêm, juntas, um nome plausível e um
 * preço — nunca um fragmento isolado ("Pedidos", "16", "autocop"). Blocos
 * sem nome plausível viram itens de confiança BAIXA, desmarcados por
 * padrão, e nunca com "Não identificado" como nome real — isso é decisão
 * de quem revisa, nunca do parser.
 */

import type { PdfPageLines, PdfTextLine } from '@/lib/pdf/extractCatalogPdfText'

export type Confidence = 'alta' | 'media' | 'baixa'

export interface PriceOption {
  label: string | null
  price: number
}

export interface ParsedCatalogItem {
  tempId: string
  name: string | null
  category: string | null
  price: number | null
  priceOptions: PriceOption[]
  unit: string | null
  minQuantity: number | null
  description: string | null
  notes: string | null
  confidence: Confidence
  needsReview: boolean
  reviewReasons: string[]
  sourcePage: number
}

const PRICE_RE = /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{2})?)/g
const MIN_QTY_RE = /m[íi]n(?:imo)?\.?\s*(?:de\s*)?(\d+)\s*(un(?:id(?:ades?)?)?|pe[çc]as?|kg|m²?|cx|caixas?)?/i
const UNIT_HINT_RE = /\b(un(?:id(?:ades?)?)?|pç|peça|kg|m²|caixa|cx|kit|par|dz|dúzia)\b/i

// Fragmentos que NUNCA viram nome de produto sozinhos, mesmo com preço no
// bloco — cabeçalhos de tabela, boilerplate institucional, rótulos soltos.
// Comparação por igualdade normalizada (não substring) para não descartar
// produtos reais que só contenham essas palavras.
const NOISE_EXACT = new Set([
  'pedidos', 'pedido', 'unidade', 'unidades', 'total', 'subtotal', 'pagina',
  'observacao', 'observacoes', 'obs', 'codigo', 'cod', 'catalogo', 'sumario',
  'indice', 'contato', 'whatsapp', 'instagram', 'facebook', 'cnpj', 'endereco',
  'telefone', 'email', 'preco', 'precos', 'valor', 'valores', 'quantidade',
  'medida', 'medidas', 'modelo', 'cor', 'cores', 'tamanho', 'material',
  'un', 'und', 'kg', 'cx', 'pc', 'dz', 'par', 'kit',
])
// Boilerplate mais longo, aí faz sentido checar substring.
const NOISE_SUBSTRING = [
  'direitos reservados', 'sujeito a alteracao', 'sujeitos a alteracao',
  'sem aviso previo', 'fale conosco', 'atendimento ao cliente', 'todos os precos',
]

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

function isNoiseLine(text: string): boolean {
  const norm = normalizeForMatch(text)
  if (!norm) return true
  if (NOISE_EXACT.has(norm)) return true
  if (NOISE_SUBSTRING.some(p => norm.includes(p))) return true
  return false
}

function parsePriceToNumber(raw: string): number {
  // "1.234,56" (BR) ou "12,50" ou "12.50" — nunca arredondar, só normalizar
  // separador decimal para Number().
  const hasComma = raw.includes(',')
  const cleaned = hasComma ? raw.replace(/\./g, '').replace(',', '.') : raw
  return Number(cleaned)
}

function findPrices(text: string): { raw: string; value: number }[] {
  const matches = [...text.matchAll(PRICE_RE)]
  return matches.map(m => ({ raw: m[0], value: parsePriceToNumber(m[1]) })).filter(p => Number.isFinite(p.value) && p.value > 0)
}

function letterRatio(text: string): number {
  const letters = (text.match(/[a-zA-ZÀ-ÿ]/g) ?? []).length
  return text.length > 0 ? letters / text.length : 0
}

function looksLikeTitle(line: PdfTextLine, bodyFontSize: number): boolean {
  const text = line.text.trim()
  if (text.length < 2 || text.length > 80) return false
  if (isNoiseLine(text)) return false
  if (/^\d+([.,]\d+)?$/.test(text)) return false // número solto
  if (letterRatio(text) < 0.5) return false
  if (PRICE_RE.test(text)) { PRICE_RE.lastIndex = 0; return false } // linha de preço não é título
  return true
}

interface Block {
  page: number
  lines: PdfTextLine[]
}

/** Agrupa linhas em blocos por proximidade vertical — a mesma técnica que
 * uma pessoa usa ao olhar o PDF: itens visualmente juntos pertencem à
 * mesma "entrada" do catálogo. Um salto vertical bem maior que o
 * espaçamento típico da página, ou uma linha em fonte visivelmente maior
 * (um novo título), começa um bloco novo. */
export function parseCatalogPages(pages: PdfPageLines[], maxItems = 500): ParsedCatalogItem[] {
  const allGaps: number[] = []
  for (const page of pages) {
    for (let i = 1; i < page.lines.length; i++) allGaps.push(page.lines[i - 1].y - page.lines[i].y)
  }
  const sortedGaps = [...allGaps].sort((a, b) => a - b)
  const medianGap = sortedGaps.length > 0 ? sortedGaps[Math.floor(sortedGaps.length / 2)] : 14
  const breakThreshold = Math.max(medianGap * 1.6, medianGap + 6)

  const fontSizes = pages.flatMap(p => p.lines.map(l => l.fontSize))
  const sortedFonts = [...fontSizes].sort((a, b) => a - b)
  const bodyFontSize = sortedFonts.length > 0 ? sortedFonts[Math.floor(sortedFonts.length / 2)] : 10

  const blocks: Block[] = []
  for (const page of pages) {
    let current: PdfTextLine[] = []
    for (let i = 0; i < page.lines.length; i++) {
      const line = page.lines[i]
      const prev = page.lines[i - 1]
      const gap = prev ? prev.y - line.y : 0
      const isNewHeading = current.length > 0 && line.fontSize >= bodyFontSize * 1.15 && looksLikeTitle(line, bodyFontSize)
      if (current.length > 0 && (gap > breakThreshold || isNewHeading)) {
        blocks.push({ page: page.page, lines: current })
        current = []
      }
      current.push(line)
    }
    if (current.length > 0) blocks.push({ page: page.page, lines: current })
  }

  const items: ParsedCatalogItem[] = []
  let currentCategory: string | null = null
  let seq = 0
  let lastKey = ''

  for (let b = 0; b < blocks.length && items.length < maxItems; b++) {
    const block = blocks[b]
    const blockText = block.lines.map(l => l.text).join(' ')
    const prices = block.lines.flatMap(l => findPrices(l.text).map(p => ({ ...p, lineIndex: block.lines.indexOf(l) })))

    // Bloco sem preço algum: pode ser um cabeçalho de categoria isolado
    // (curto, próximo do próximo bloco COM preço) — nunca vira produto.
    if (prices.length === 0) {
      const soleLine = block.lines.length === 1 ? block.lines[0] : null
      const next = blocks[b + 1]
      const nextHasPrice = next ? findPrices(next.lines.map(l => l.text).join(' ')).length > 0 : false
      if (soleLine && nextHasPrice && looksLikeTitle(soleLine, bodyFontSize)) {
        currentCategory = soleLine.text.trim()
      }
      continue
    }

    // ── Nome: primeira linha do bloco que parece título de verdade ──
    const titleLine = block.lines.find(l => looksLikeTitle(l, bodyFontSize) && findPrices(l.text).length === 0)
    const reviewReasons: string[] = []
    let confidence: Confidence = 'alta'
    let name: string | null = titleLine ? titleLine.text.trim() : null

    if (!name) {
      confidence = 'baixa'
      reviewReasons.push('Nome não identificado')
    } else if (name.length < 3) {
      confidence = 'baixa'
      reviewReasons.push('Nome muito curto para confirmar')
    }

    // ── Preço(s): mais de um valor distinto no bloco = possível tabela de
    // variações (tamanho/quantidade/cor) — nunca vira produtos separados. ──
    const distinctPrices = [...new Map(prices.map(p => [p.value, p])).values()]
    let price: number | null = null
    let priceOptions: PriceOption[] = []

    if (distinctPrices.length === 1) {
      price = distinctPrices[0].value
    } else if (distinctPrices.length > 1) {
      price = Math.min(...distinctPrices.map(p => p.value))
      priceOptions = distinctPrices.map(p => {
        const line = block.lines[p.lineIndex]
        const label = line ? line.text.replace(PRICE_RE, '').trim() || null : null
        return { label, price: p.value }
      })
      if (priceOptions.every(o => !o.label)) {
        confidence = confidence === 'alta' ? 'media' : confidence
        reviewReasons.push('Várias variações de preço sem rótulo claro')
      }
    }

    const minQtyMatch = blockText.match(MIN_QTY_RE)
    const minQuantity = minQtyMatch ? Number(minQtyMatch[1]) : null
    const unitHintMatch = blockText.match(UNIT_HINT_RE)
    const unit = unitHintMatch ? unitHintMatch[1].toLowerCase() : null

    const description = block.lines
      .filter(l => l !== titleLine && findPrices(l.text).length === 0 && !isNoiseLine(l.text))
      .map(l => l.text.trim())
      .filter(Boolean)
      .join(' ')
      .slice(0, 500) || null

    if (block.lines.length > 12) {
      confidence = confidence === 'alta' ? 'media' : confidence
      reviewReasons.push('Bloco muito extenso — pode misturar mais de um produto')
    }

    const key = `${normalizeForMatch(name ?? '')}|${price ?? ''}`
    if (name && key === lastKey) continue
    lastKey = key

    items.push({
      tempId: `item-${seq++}`,
      name,
      category: currentCategory,
      price,
      priceOptions,
      unit,
      minQuantity,
      description,
      notes: null,
      confidence,
      needsReview: confidence !== 'alta',
      reviewReasons,
      sourcePage: block.page,
    })
  }

  return items
}
