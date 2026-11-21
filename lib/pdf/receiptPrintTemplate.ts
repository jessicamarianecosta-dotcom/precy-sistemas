/* ============================================================
   PRECY+ — Template de impressão do Recibo (HTML/CSS)
   Confirmação de um recebimento JÁ registrado — nunca gera cobrança
   nem valor novo, só exibe o que já está em payment_history.
   ============================================================ */

import { formatCurrency } from '@/lib/utils/format'

const X = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')

const D = (iso?: string | null) => {
  if (!iso) return ''
  try {
    const d = iso.length === 10 ? new Date(iso + 'T00:00:00') : new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return '' }
}

export interface ReceiptPrintItem {
  name: string
  description: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface ReceiptPrintVM {
  company: { name: unknown; email?: unknown; phone?: unknown; cnpj?: unknown; logoUrl?: string | null; primaryColor?: unknown }
  order: { number: unknown; serviceName?: unknown; balanceAfter: number; items?: ReceiptPrintItem[] }
  customer: { name?: unknown; cpfCnpj?: unknown }
  receipt: { amount: number; paymentDate: string; paymentMethodLabel: string; observation?: unknown }
}

export function renderReceiptPrintHTML(vm: ReceiptPrintVM): string {
  const co = vm.company
  const coName = X(co.name ?? 'Empresa')
  const primary = String(co.primaryColor ?? '#1a1208')
  const logoHTML = co.logoUrl
    ? `<img src="${co.logoUrl}" alt="${coName}" style="max-height:56px;max-width:160px;object-fit:contain;">`
    : `<div style="width:48px;height:48px;background:${primary};border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:700;">${coName.charAt(0).toUpperCase()}</div>`

  const docTitle = `Recibo — Pedido ${X(vm.order.number)}`

  const items = vm.order.items ?? []
  const itemsRowsHTML = items.map(item => {
    const qty = Number(item.quantity) || 1
    const up  = Number(item.unit_price) || 0
    const sub = Number(item.subtotal)   || 0
    return `
      <tr>
        <td>
          <div class="it-name">${X(item.name)}</div>
          ${item.description ? `<div class="it-desc">${X(item.description)}</div>` : ''}
        </td>
        <td class="r">${qty}</td>
        <td class="r">${formatCurrency(up)}</td>
        <td class="r">${formatCurrency(sub)}</td>
      </tr>`
  }).join('')

  const itemsBlockHTML = items.length > 0 ? `
  <div class="islbl">Itens pagos</div>
  <div class="itw">
    <table>
      <thead>
        <tr>
          <th>Produto / Descrição</th>
          <th class="r" style="width:50px;">Qtd</th>
          <th class="r" style="width:90px;">Vlr. Unit.</th>
          <th class="r" style="width:90px;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsRowsHTML}</tbody>
    </table>
  </div>
  ${vm.order.balanceAfter > 0 ? `
  <div class="items-note">Pagamento parcial — o valor recebido neste recibo está destacado acima; os itens listados correspondem ao pedido completo.</div>` : ''}` : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${docTitle}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  @page{size:A4 portrait;margin:13mm 11mm 15mm 11mm;}
  @media print{ .no-print{display:none!important;} .page{margin:0!important;box-shadow:none!important;width:100%!important;} }
  html,body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#ddd;color:#1a1208;font-size:13px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .toolbar{background:#1a1208;padding:11px 20px;position:sticky;top:0;z-index:99;display:flex;align-items:center;gap:10px;}
  .btn{padding:8px 18px;border:none;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;}
  .btn-p{background:#fff;color:#1a1208;}
  .page{background:#fff;width:210mm;min-height:140mm;margin:20px auto;box-shadow:0 4px 40px rgba(0,0,0,.18);}
  .stripe{height:4px;background:${primary};}
  .hdr{display:flex;justify-content:space-between;align-items:center;padding:22px 28px;border-bottom:1px solid #ede9e3;}
  .ok{margin:18px 28px;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;
    font-size:11.5px;color:#15803d;font-weight:700;text-align:center;letter-spacing:.3px;}
  .amt-box{text-align:center;padding:18px 28px 6px;}
  .amt-lbl{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#999;margin-bottom:4px;}
  .amt-val{font-size:34px;font-weight:700;color:#15803d;}
  .grid{display:table;width:100%;padding:16px 28px;}
  .cell{display:table-cell;width:25%;vertical-align:top;padding-right:10px;}
  .lbl{font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#bbb;margin-bottom:3px;}
  .val{font-size:13px;color:#1a1208;font-weight:600;}
  .obs{margin:0 28px 20px;font-size:11.5px;color:#666;}
  .islbl{font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#bbb;
    padding:4px 28px 7px;display:flex;align-items:center;gap:8px;}
  .islbl::after{content:'';flex:1;height:1px;background:#ede9e3;}
  .itw{padding:0 28px 10px;}
  .itw table{width:100%;border-collapse:collapse;border:1px solid #ede9e3;border-radius:8px;overflow:hidden;table-layout:fixed;}
  .itw thead tr{background:#f5f2ee;}
  .itw th{padding:8px 10px;font-size:8.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;
    color:#9a8a7a;text-align:left;}
  .itw th.r{text-align:right;}
  .itw td{padding:9px 10px;border-top:1px solid #ede9e3;font-size:11.5px;color:#333;
    vertical-align:top;word-wrap:break-word;overflow-wrap:break-word;white-space:normal;}
  .itw td.r{text-align:right;white-space:nowrap;}
  .itw .it-name{font-weight:600;color:#1a1208;line-height:1.4;}
  .itw .it-desc{font-size:10.5px;color:#9a8a7a;margin-top:2px;line-height:1.5;white-space:pre-wrap;}
  .items-note{margin:0 28px 20px;font-size:10.5px;color:#9a8a7a;font-style:italic;}
  .footer{padding:16px 28px;border-top:1px solid #ede9e3;font-size:10px;color:#aaa;display:flex;justify-content:space-between;}
</style>
</head>
<body>
<div class="toolbar no-print">
  <button class="btn btn-p" onclick="window.print()">🖨️ Salvar como PDF</button>
  <span style="color:rgba(255,255,255,.5);font-size:11.5px;margin-left:auto;">${docTitle}</span>
</div>
<div class="page">
  <div class="stripe"></div>
  <div class="hdr">
    ${logoHTML}
    <div style="text-align:right;">
      <div style="font-size:15px;font-weight:700;">${coName}</div>
      ${co.cnpj ? `<div style="font-size:10.5px;color:#999;">CNPJ ${X(co.cnpj)}</div>` : ''}
    </div>
  </div>

  <div class="ok">RECIBO DE PAGAMENTO</div>

  <div class="amt-box">
    <div class="amt-lbl">Valor recebido</div>
    <div class="amt-val">${formatCurrency(vm.receipt.amount)}</div>
  </div>

  <div class="grid">
    <div class="cell"><div class="lbl">Cliente</div><div class="val">${X(vm.customer.name ?? '—')}</div></div>
    <div class="cell"><div class="lbl">Pedido</div><div class="val">${X(vm.order.number)}</div></div>
    <div class="cell"><div class="lbl">Data</div><div class="val">${D(vm.receipt.paymentDate)}</div></div>
    <div class="cell"><div class="lbl">Forma de pagamento</div><div class="val">${X(vm.receipt.paymentMethodLabel)}</div></div>
  </div>

  ${vm.order.balanceAfter > 0 ? `
  <div class="obs"><b>Saldo restante do pedido:</b> ${formatCurrency(vm.order.balanceAfter)}</div>` : `
  <div class="obs" style="color:#15803d;"><b>Pedido quitado.</b></div>`}

  ${vm.receipt.observation ? `<div class="obs">${X(vm.receipt.observation)}</div>` : ''}

  ${itemsBlockHTML}

  <div class="footer">
    <span>${coName}</span>
    <span>Gerado em ${new Date().toLocaleDateString('pt-BR')} · <b>Precy+</b></span>
  </div>
</div>
</body>
</html>`
}

export function openReceiptPrintWindow(html: string): void {
  const win = window.open('', '_blank', 'width=980,height=760')
  if (win) { win.document.write(html); win.document.close(); win.focus() }
}
