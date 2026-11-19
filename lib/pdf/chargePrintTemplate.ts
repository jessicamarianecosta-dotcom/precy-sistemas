/* ============================================================
   PRECY+ — Template de impressão da Cobrança (HTML/CSS)

   Mesmo padrão visual do orçamento (budgetPrintTemplate.ts): uma
   janela HTML pronta para "Salvar como PDF" pelo navegador. Usada
   tanto pelo link público (/loja/cobranca/[token]) quanto, se o
   lojista quiser, direto do painel — os dois sempre a partir dos
   dados já resolvidos pela própria rota pública, nunca de uma
   segunda fonte de verdade.
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

const STATUS_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  pendente:  { label: 'Pendente',  bg: '#dbeafe', fg: '#1d4ed8' },
  vencida:   { label: 'Vencida',   bg: '#fee2e2', fg: '#b91c1c' },
  paga:      { label: 'Paga',      bg: '#dcfce7', fg: '#15803d' },
  cancelada: { label: 'Cancelada', bg: '#f0ece6', fg: '#7a6855' },
}

export interface ChargePrintVM {
  company: { name: unknown; email?: unknown; phone?: unknown; cnpj?: unknown; logoUrl?: string | null; primaryColor?: unknown }
  order: { number: unknown; serviceName?: unknown }
  customer: { name?: unknown }
  charge: { amountDue: number; dueDate: string; status: string; notes?: unknown; createdAt?: unknown }
  pix: { key: string; label: string; payload: string; qrCodeBase64: string } | null
}

export function renderChargePrintHTML(vm: ChargePrintVM): string {
  const co = vm.company
  const coName = X(co.name ?? 'Empresa')
  const primary = String(co.primaryColor ?? '#1a1208')
  const logoHTML = co.logoUrl
    ? `<img src="${co.logoUrl}" alt="${coName}" style="max-height:56px;max-width:160px;object-fit:contain;">`
    : `<div style="width:48px;height:48px;background:${primary};border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:700;">${coName.charAt(0).toUpperCase()}</div>`

  const badge = STATUS_BADGE[vm.charge.status] ?? STATUS_BADGE.pendente
  const docTitle = `Cobrança — Pedido ${X(vm.order.number)}`

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
  .page{background:#fff;width:210mm;min-height:150mm;margin:20px auto;box-shadow:0 4px 40px rgba(0,0,0,.18);}
  .stripe{height:4px;background:${primary};}
  .hdr{display:flex;justify-content:space-between;align-items:center;padding:22px 28px;border-bottom:1px solid #ede9e3;}
  .warn{margin:18px 28px;padding:12px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;
    font-size:11.5px;color:#9a3412;font-weight:600;text-align:center;}
  .amt-box{text-align:center;padding:18px 28px 6px;}
  .amt-lbl{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#999;margin-bottom:4px;}
  .amt-val{font-size:34px;font-weight:700;color:${primary};}
  .badge{display:inline-block;margin-top:10px;padding:4px 14px;border-radius:20px;font-size:10.5px;font-weight:700;
    letter-spacing:.5px;text-transform:uppercase;background:${badge.bg};color:${badge.fg};}
  .grid{display:table;width:100%;padding:16px 28px;}
  .cell{display:table-cell;width:33%;vertical-align:top;padding-right:10px;}
  .lbl{font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#bbb;margin-bottom:3px;}
  .val{font-size:13px;color:#1a1208;font-weight:600;}
  .pix-w{margin:10px 28px 20px;border:1px solid #ede9e3;border-radius:10px;padding:18px;display:flex;gap:18px;align-items:center;}
  .pix-qr{width:150px;height:150px;border-radius:8px;border:1px solid #ede9e3;flex-shrink:0;}
  .pix-info{font-size:11.5px;color:#555;line-height:1.9;}
  .pix-code{font-family:'Courier New',monospace;font-size:9.5px;word-break:break-all;background:#faf8f5;
    border:1px dashed #ddd;border-radius:6px;padding:8px 10px;margin-top:6px;color:#444;}
  .obs{margin:0 28px 20px;font-size:11.5px;color:#666;}
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

  <div class="warn">ESTA É UMA COBRANÇA — AINDA NÃO É UM COMPROVANTE DE PAGAMENTO</div>

  <div class="amt-box">
    <div class="amt-lbl">Valor a pagar</div>
    <div class="amt-val">${formatCurrency(vm.charge.amountDue)}</div>
    <div><span class="badge">${badge.label}</span></div>
  </div>

  <div class="grid">
    <div class="cell"><div class="lbl">Cliente</div><div class="val">${X(vm.customer.name ?? '—')}</div></div>
    <div class="cell"><div class="lbl">Pedido</div><div class="val">${X(vm.order.number)}</div></div>
    <div class="cell"><div class="lbl">Vencimento</div><div class="val">${D(vm.charge.dueDate)}</div></div>
  </div>

  ${vm.pix ? `
  <div class="pix-w">
    <img class="pix-qr" src="${vm.pix.qrCodeBase64}" alt="QR Code Pix">
    <div class="pix-info">
      <div><b>Pagamento via Pix</b></div>
      <div>Chave Pix (CNPJ): <b>${X(vm.pix.key)}</b></div>
      ${vm.pix.label ? `<div>Beneficiário: ${X(vm.pix.label)}</div>` : ''}
      <div>Pix copia e cola:</div>
      <div class="pix-code">${X(vm.pix.payload)}</div>
    </div>
  </div>` : ''}

  ${vm.charge.notes ? `<div class="obs"><b>Observações:</b> ${X(vm.charge.notes)}</div>` : ''}

  <div class="footer">
    <span>${coName}</span>
    <span>Gerado em ${new Date().toLocaleDateString('pt-BR')} · <b>Precy+</b></span>
  </div>
</div>
</body>
</html>`
}

/** Abre o HTML gerado numa nova janela/aba, pronta para imprimir/salvar como PDF. */
export function openChargePrintWindow(html: string): void {
  const win = window.open('', '_blank', 'width=980,height=760')
  if (win) { win.document.write(html); win.document.close(); win.focus() }
}
