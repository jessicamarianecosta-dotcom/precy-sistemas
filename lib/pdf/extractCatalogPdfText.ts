import { pdfjs } from 'react-pdf'
import '@/lib/utils/pdfWorker'

/**
 * Extrai a ESTRUTURA do PDF (não um texto solto): cada linha reconstruída a
 * partir da posição real de cada fragmento de texto do pdf.js — x, y e
 * tamanho de fonte — preservando o suficiente para o parser (ver
 * lib/catalog/pdfCatalogParser.ts) identificar títulos, agrupar blocos de
 * produto e ignorar cabeçalho/rodapé por geometria, em vez de achar que
 * "toda linha com preço é um produto".
 *
 * Cabeçalho/rodapé (número de página, nome do catálogo repetido em toda
 * página etc.) é descartado aqui, pela posição vertical na página — é
 * informação geométrica que só existe neste momento da extração, antes de
 * tudo virar string.
 */

export interface PdfTextLine {
  x: number
  y: number
  text: string
  fontSize: number
}

export interface PdfPageLines {
  page: number
  lines: PdfTextLine[]
}

export interface PdfCatalogLayout {
  pageCount: number
  pages: PdfPageLines[]
}

const HEADER_FOOTER_BAND = 0.06 // 6% do topo e 6% da base da página

export async function extractCatalogPdfLayout(file: File): Promise<PdfCatalogLayout> {
  const buffer = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buffer }).promise

  const pages: PdfPageLines[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()

    type Item = { str: string; transform: number[] }
    const rows = new Map<number, { x: number; str: string; fontSize: number }[]>()

    for (const raw of content.items as Item[]) {
      if (!raw.str || !raw.str.trim()) continue
      const y = raw.transform[5]
      const fontSize = Math.abs(raw.transform[3]) || Math.abs(raw.transform[0]) || 10
      // Agrupa itens cuja baseline vertical difere menos de 3px na mesma linha.
      const rowKey = [...rows.keys()].find(k => Math.abs(k - y) <= 3) ?? y
      const row = rows.get(rowKey) ?? []
      row.push({ x: raw.transform[4], str: raw.str, fontSize })
      rows.set(rowKey, row)
    }

    const topBand = viewport.height * (1 - HEADER_FOOTER_BAND)
    const bottomBand = viewport.height * HEADER_FOOTER_BAND

    const lines: PdfTextLine[] = [...rows.entries()]
      .filter(([y]) => y < topBand && y > bottomBand) // fora do cabeçalho/rodapé
      .sort((a, b) => b[0] - a[0]) // topo → base
      .map(([y, items]) => {
        const sorted = items.sort((a, b) => a.x - b.x)
        const text = sorted.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim()
        const fontSize = Math.round((sorted.reduce((s, i) => s + i.fontSize, 0) / sorted.length) * 2) / 2
        return { x: sorted[0].x, y, text, fontSize }
      })
      .filter(l => l.text.length > 0)

    pages.push({ page: pageNum, lines })
  }

  return { pageCount: doc.numPages, pages }
}
