/* ============================================================
   PRECY+ — Documento de Declaração de Conteúdo
   Gera o HTML do documento (A4, fundo branco, sem elementos de
   interface) — reaproveitado tanto pelo preview ao vivo (iframe)
   quanto pela impressão/PDF (window.open), fonte única de verdade
   para o layout do documento.
   ============================================================ */

import { formatCurrency } from '@/lib/utils/format'

export interface DeclarationPartyDoc {
  name:         string
  document:     string | null
  zipCode:      string | null
  street:       string | null
  number:       string | null
  complement:   string | null
  neighborhood: string | null
  city:         string | null
  state:        string | null
}

export interface DeclarationItemDoc {
  description: string
  quantity:    number
  value:       number
}

export interface DeclarationDocumentData {
  sender:          DeclarationPartyDoc
  recipient:       DeclarationPartyDoc
  items:           DeclarationItemDoc[]
  totalQuantity:   number
  totalValue:      number
  totalWeightKg:   number | null
  declarationCity: string
  declarationDate: string // ISO yyyy-mm-dd
  notes?:          string | null
}

/**
 * Texto-modelo da declaração — tratado como um MODELO de documento, não
 * como um texto oficial aprovado por Correios/órgão público (não alterar
 * essa ressalva). Mantido isolado aqui para poder ser atualizado no futuro
 * sem tocar no restante do layout.
 */
export const DECLARATION_STATEMENT_TEXT =
  'Declaro, para os devidos fins e sob as penas da lei, que os bens relacionados nesta ' +
  'Declaração de Conteúdo correspondem fielmente ao conteúdo do volume entregue para ' +
  'transporte, não contendo armas, explosivos, produtos inflamáveis, tóxicos, entorpecentes ' +
  'ou qualquer item cujo envio seja proibido por lei, assumindo integral responsabilidade ' +
  'pelas informações aqui prestadas.'

export const DECLARATION_OBSERVATION_TEXT =
  'Este documento tem caráter declaratório, preenchido e assinado pelo próprio remetente, ' +
  'e não substitui a Nota Fiscal, quando exigida por lei, nem representa aprovação, ' +
  'homologação ou vínculo com Correios, transportadoras ou qualquer órgão público.'

const X = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const R = (v: unknown) => formatCurrency(Number(v) || 0)

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function formatDeclarationDate(iso: string): { day: string; month: string; year: string } {
  const [y, m, d] = (iso || '').split('-').map(Number)
  if (!y || !m || !d) {
    const now = new Date()
    return { day: String(now.getDate()), month: MONTHS_PT[now.getMonth()], year: String(now.getFullYear()) }
  }
  return { day: String(d), month: MONTHS_PT[m - 1] ?? '', year: String(y) }
}

function formatCep(cep: string | null): string {
  const d = (cep ?? '').replace(/\D/g, '')
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (cep ?? '')
}

function partyAddressLine(p: DeclarationPartyDoc): string {
  const parts = [p.street, p.number].filter(Boolean).join(', ')
  const full = [parts, p.complement].filter(Boolean).join(' - ')
  return [full, p.neighborhood].filter(Boolean).join(' - ')
}

function partyBlockHTML(label: string, p: DeclarationPartyDoc): string {
  const addr = partyAddressLine(p)
  const cep = formatCep(p.zipCode)
  return `
  <div class="party">
    <div class="party-title">${label}</div>
    <div class="party-grid">
      <div class="pf pf-w"><span class="plbl">Nome</span><span class="pval">${X(p.name) || '—'}</span></div>
      <div class="pf pf-w"><span class="plbl">Endereço</span><span class="pval">${X(addr) || '—'}</span></div>
      <div class="pf"><span class="plbl">Cidade</span><span class="pval">${X(p.city) || '—'}</span></div>
      <div class="pf pf-sm"><span class="plbl">UF</span><span class="pval">${X(p.state) || '—'}</span></div>
      <div class="pf"><span class="plbl">CEP</span><span class="pval">${X(cep) || '—'}</span></div>
      <div class="pf pf-w"><span class="plbl">CPF/CNPJ</span><span class="pval">${X(p.document) || '—'}</span></div>
    </div>
  </div>`
}

/** Constrói o HTML completo do documento (A4). `withToolbar` adiciona a barra de impressão (usada só na janela de impressão, nunca no preview embutido). */
export function buildDeclarationDocumentHTML(data: DeclarationDocumentData, opts: { withToolbar?: boolean } = {}): string {
  const { withToolbar = false } = opts
  const { day, month, year } = formatDeclarationDate(data.declarationDate)

  const rowsHTML = data.items.length === 0
    ? `<tr><td colspan="4" style="text-align:center;padding:22px;color:#bbb;font-size:11.5px;font-style:italic;">Nenhum item adicionado</td></tr>`
    : data.items.map((item, idx) => `
      <tr>
        <td class="td-c">${idx + 1}</td>
        <td>${X(item.description)}</td>
        <td class="td-c">${Number(item.quantity) || 0}</td>
        <td class="td-r">${R(item.value)}</td>
      </tr>`).join('')

  const weightHTML = data.totalWeightKg != null
    ? `${Number(data.totalWeightKg).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`
    : '—'

  const toolbarHTML = withToolbar ? `
  <div class="toolbar no-print">
    <button class="btn btn-p" onclick="window.print()">🖨 Imprimir / Salvar PDF</button>
    <button class="btn btn-c" onclick="window.close()">Fechar</button>
    <span class="tb-title">Declaração de Conteúdo</span>
  </div>` : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Declaração de Conteúdo — ${X(data.recipient.name)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  @page{size:A4 portrait;margin:14mm 16mm;}
  @media print{
    html,body{background:#fff;}
    .no-print{display:none!important;}
    .page{margin:0!important;box-shadow:none!important;width:100%!important;}
  }
  html,body{
    font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
    background:#ddd;color:#111;font-size:12.5px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  .toolbar{background:#1a1208;padding:11px 20px;position:sticky;top:0;z-index:99;display:flex;align-items:center;gap:10px;}
  .tb-title{color:rgba(255,255,255,.5);font-size:11.5px;margin-left:auto;}
  .btn{padding:8px 18px;border:none;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;}
  .btn-p{background:#fff;color:#1a1208;}
  .btn-c{background:transparent;color:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.2)!important;}
  .page{background:#fff;width:210mm;min-height:297mm;margin:20px auto;box-shadow:0 4px 40px rgba(0,0,0,.18);padding:16mm 14mm;color:#111;}
  .title{text-align:center;font-size:16px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;}
  .subtitle{text-align:center;font-size:10px;color:#777;margin-bottom:18px;}
  .party{border:1px solid #ccc;border-radius:6px;padding:10px 14px;margin-bottom:12px;}
  .party-title{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#555;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:5px;}
  .party-grid{display:flex;flex-wrap:wrap;gap:8px 18px;}
  .pf{display:flex;flex-direction:column;min-width:110px;}
  .pf-w{min-width:220px;flex:1 1 220px;}
  .pf-sm{min-width:48px;}
  .plbl{font-size:8.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#999;margin-bottom:2px;}
  .pval{font-size:12px;color:#111;}
  .sec-title{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#333;margin:16px 0 8px;text-align:center;}
  table{width:100%;border-collapse:collapse;border:1px solid #ccc;margin-bottom:2px;}
  thead tr{background:#f2f0ec;}
  thead th{padding:7px 10px;font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#444;text-align:left;border-bottom:1px solid #ccc;}
  th.th-c,td.td-c{text-align:center;}
  th.th-r,td.td-r{text-align:right;}
  tbody td{padding:7px 10px;font-size:12px;border-bottom:1px solid #eee;}
  tfoot td{padding:8px 10px;font-size:12px;font-weight:700;border-top:1.5px solid #999;background:#f8f7f5;}
  .totals-row{display:flex;justify-content:space-between;padding:8px 2px 0;font-size:11.5px;}
  .totals-row b{font-size:12.5px;}
  .weight-box{margin-top:10px;border:1px solid #ccc;border-radius:6px;padding:8px 14px;display:flex;justify-content:space-between;align-items:center;}
  .weight-lbl{font-size:9.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#666;}
  .weight-val{font-size:13px;font-weight:700;}
  .statement{margin-top:20px;font-size:11px;line-height:1.7;color:#333;text-align:justify;}
  .date-line{margin-top:22px;font-size:12px;}
  .sign-area{margin-top:46px;text-align:center;}
  .sign-line{border-top:1px solid #333;width:280px;margin:0 auto;padding-top:6px;font-size:10.5px;color:#555;}
  .obs{margin-top:26px;font-size:9.5px;color:#888;line-height:1.6;border-top:1px solid #eee;padding-top:10px;}
  .obs b{color:#666;}
</style>
</head>
<body>
${toolbarHTML}
<div class="page">
  <div class="title">Declaração de Conteúdo</div>
  <div class="subtitle">Documento gerado pelo Precy+</div>

  ${partyBlockHTML('Remetente', data.sender)}
  ${partyBlockHTML('Destinatário', data.recipient)}

  <div class="sec-title">Identificação dos Bens</div>
  <table>
    <thead>
      <tr>
        <th class="th-c" style="width:34px;">Item</th>
        <th>Conteúdo</th>
        <th class="th-c" style="width:80px;">Quantidade</th>
        <th class="th-r" style="width:110px;">Valor</th>
      </tr>
    </thead>
    <tbody>${rowsHTML}</tbody>
    <tfoot>
      <tr>
        <td colspan="2" class="td-c">TOTAL</td>
        <td class="td-c">${data.totalQuantity}</td>
        <td class="td-r">${R(data.totalValue)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="weight-box">
    <span class="weight-lbl">Peso total</span>
    <span class="weight-val">${weightHTML}</span>
  </div>

  <div class="statement">${X(DECLARATION_STATEMENT_TEXT)}</div>

  <div class="date-line">${X(data.declarationCity) || '—'}, ${day} de ${month} de ${year}.</div>

  <div class="sign-area">
    <div class="sign-line">Assinatura do Declarante/Remetente</div>
  </div>

  ${data.notes ? `<div class="obs"><b>OBSERVAÇÃO:</b> ${X(data.notes)}</div>` : ''}
  <div class="obs">${X(DECLARATION_OBSERVATION_TEXT)}</div>
</div>
</body>
</html>`
}

/** Abre a janela de impressão/PDF — mesmo padrão de generateOrderPDF.ts (window.open + window.print). */
export function printContentDeclaration(data: DeclarationDocumentData) {
  const html = buildDeclarationDocumentHTML(data, { withToolbar: true })
  const win = window.open('', '_blank', 'width=980,height=760')
  if (win) { win.document.write(html); win.document.close(); win.focus() }
}
