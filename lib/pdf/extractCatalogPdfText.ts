import { pdfjs } from 'react-pdf'
import '@/lib/utils/pdfWorker'

/**
 * Extrai o texto de um PDF no browser, reconstruindo quebras de linha a
 * partir da posição vertical de cada item de texto do pdf.js — sem isso,
 * getTextContent() devolve os fragmentos de uma linha de tabela inteira
 * concatenados sem separador, e o parser (lib/catalog/pdfCatalogParser.ts)
 * depende de "uma linha = um produto/preço" para funcionar.
 */
export async function extractCatalogPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buffer }).promise

  const pageTexts: string[] = []
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()

    type Item = { str: string; transform: number[] }
    const rows = new Map<number, { x: number; str: string }[]>()

    for (const raw of content.items as Item[]) {
      if (!raw.str || !raw.str.trim()) continue
      const y = Math.round(raw.transform[5])
      // Agrupa itens cuja baseline vertical difere menos de 3px na mesma linha.
      const rowKey = [...rows.keys()].find(k => Math.abs(k - y) <= 3) ?? y
      const row = rows.get(rowKey) ?? []
      row.push({ x: raw.transform[4], str: raw.str })
      rows.set(rowKey, row)
    }

    const sortedRowKeys = [...rows.keys()].sort((a, b) => b - a) // topo → base
    const lines = sortedRowKeys.map(key =>
      (rows.get(key) ?? [])
        .sort((a, b) => a.x - b.x)
        .map(i => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )

    pageTexts.push(lines.filter(Boolean).join('\n'))
  }

  return pageTexts.join('\n\n')
}
