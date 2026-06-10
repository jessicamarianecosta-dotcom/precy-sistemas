/* ============================================================
   PRECY+ — Template PDF Profissional
   Visual: Gráfica / Comunicação Visual / ERP Premium
   Estrutura: Editorial corporativa, tipografia hierárquica
   ============================================================ */

interface PDFParams {
  budget:  Record<string, unknown>
  items:   Record<string, unknown>[]
  company: Record<string, unknown> | null
}

const fmt = (v: unknown) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return '—' }
}

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')

export async function generateBudgetPDF({ budget, items, company }: PDFParams) {
  const co = company as any ?? {}
  const primary = String(co.primary_color ?? '#1a1208')

  /* ── Dados da empresa ── */
  const companyName  = esc(co.name    ?? 'Precy+')
  const companyEmail = esc(co.email   ?? '')
  const companyPhone = esc(co.phone   ?? '')
  const companyCnpj  = esc(co.cnpj    ?? '')
  const companyAddr  = esc(co.address ?? '')
  const logoUrl      = co.logo_url as string | undefined

  /* ── Dados do orçamento ── */
  const budgetNum  = esc(budget.budget_number ?? 'ORC-0001')
  const createdAt  = fmtDate(budget.created_at as string)
  const validUntil = fmtDate(budget.valid_until as string)
  const notes      = esc(budget.notes ?? '')
  const payMethod  = esc((budget as any).payment_method ?? '')
  const subtotal   = Number(budget.subtotal) || items.reduce((s, i) => s + (Number(i.subtotal) || 0), 0)
  const discount   = Number(budget.discount) || 0
  const total      = Number(budget.total) || 0

  /* ── Dados do cliente ── */
  const cust       = (budget.customers as any) ?? {}
  const clientName  = esc(cust.name  ?? '—')
  const clientPhone = esc(cust.phone ?? '—')
  const clientEmail = esc(cust.email ?? '—')
  const clientCity  = esc(cust.city  ?? '')

  /* ── Logo ── */
  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:64px;max-width:180px;object-fit:contain;display:block;">`
    : `<div style="width:60px;height:60px;background:${primary};border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:700;font-family:Georgia,serif;">${String(co.name ?? 'P').charAt(0)}</div>`

  /* ── Linhas de itens ── */
  const rowsHTML = items.length === 0
    ? `<tr><td colspan="5" style="text-align:center;padding:28px 0;color:#aaa;font-size:13px;font-style:italic;">Nenhum item cadastrado</td></tr>`
    : items.map((item, idx) => {
        const name = esc(item.material_name ?? item.name ?? item.product_name ?? 'Item')
        const desc = esc(item.description ?? '')
        const qty  = Number(item.quantity) || 1
        const up   = Number(item.unit_price) || 0
        const sub  = Number(item.subtotal) || 0
        const bg   = idx % 2 === 0 ? '#ffffff' : '#f8f7f5'
        return `
        <tr style="background:${bg};page-break-inside:avoid;">
          <td style="padding:10px 12px;border-bottom:1px solid #e8e5e0;color:#888;font-size:11px;text-align:center;width:30px;vertical-align:top;">${idx + 1}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e8e5e0;vertical-align:top;">
            <div style="font-size:12.5px;font-weight:600;color:#1a1208;line-height:1.4;">${name}</div>
            ${desc ? `<div style="font-size:11px;color:#888;margin-top:2px;line-height:1.5;">${desc}</div>` : ''}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e8e5e0;text-align:center;font-size:12.5px;color:#333;width:56px;vertical-align:top;">${qty}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e8e5e0;text-align:right;font-size:12.5px;color:#333;width:96px;vertical-align:top;">${fmt(up)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e8e5e0;text-align:right;font-size:12.5px;font-weight:700;color:#1a1208;width:96px;vertical-align:top;">${fmt(sub)}</td>
        </tr>`
      }).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Orçamento ${budgetNum} — ${companyName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}

  @page{
    size:A4 portrait;
    margin:14mm 12mm 16mm 12mm;
  }

  @media print{
    html,body{background:#fff;}
    .no-print{display:none!important;}
    .page{margin:0!important;box-shadow:none!important;max-width:100%!important;}
  }

  html,body{
    font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
    font-size:13px;
    color:#1a1208;
    background:#ddd;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
  }

  /* ── Print toolbar ── */
  .toolbar{
    background:#1a1208;
    padding:12px 20px;
    display:flex;
    align-items:center;
    gap:12px;
    position:sticky;
    top:0;
    z-index:100;
    box-shadow:0 2px 8px rgba(0,0,0,.3);
  }
  .toolbar-title{color:rgba(255,255,255,.55);font-size:12px;margin-left:auto;}
  .btn{padding:8px 20px;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;letter-spacing:.2px;}
  .btn-print{background:#fff;color:#1a1208;}
  .btn-print:hover{background:#f0ece6;}
  .btn-close{background:transparent;color:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.2)!important;}

  /* ── Document page ── */
  .page{
    background:#fff;
    width:210mm;
    min-height:297mm;
    margin:20px auto;
    box-shadow:0 4px 40px rgba(0,0,0,.18);
    position:relative;
  }

  /* ── Top rule (cor da empresa) ── */
  .rule-top{height:4px;background:${primary};}

  /* ── Header ── */
  .doc-header{
    display:table;
    width:100%;
    padding:22px 28px 18px;
    border-bottom:1px solid #e8e5e0;
  }
  .hdr-left{display:table-cell;vertical-align:middle;width:60%;}
  .hdr-right{display:table-cell;vertical-align:middle;text-align:right;}

  .co-block{display:table;margin-top:10px;}
  .co-logo{display:table-cell;vertical-align:middle;padding-right:14px;}
  .co-info{display:table-cell;vertical-align:middle;}
  .co-name{font-size:15px;font-weight:700;color:#1a1208;letter-spacing:-.2px;margin-bottom:3px;}
  .co-detail{font-size:10.5px;color:#888;line-height:1.8;}

  /* ── Budget card (direita) ── */
  .budget-card{
    display:inline-block;
    border:2px solid #1a1208;
    border-radius:8px;
    padding:12px 18px 10px;
    min-width:150px;
    text-align:right;
  }
  .bc-label{font-size:8px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#999;display:block;margin-bottom:2px;}
  .bc-number{font-size:19px;font-weight:700;color:#1a1208;font-family:'Courier New',monospace;display:block;margin-bottom:8px;letter-spacing:-.5px;}
  .bc-row{font-size:10px;margin-top:2px;color:#555;}
  .bc-row span{font-weight:600;color:#1a1208;}

  /* ── Section label ── */
  .sec-label{
    font-size:8px;
    font-weight:700;
    letter-spacing:3px;
    text-transform:uppercase;
    color:#999;
    padding:14px 28px 6px;
    display:flex;
    align-items:center;
    gap:8px;
  }
  .sec-label::after{content:'';flex:1;height:1px;background:#e8e5e0;}

  /* ── Client section ── */
  .client-section{padding:0 28px 16px;}
  .client-grid{
    display:table;
    width:100%;
    border:1px solid #e8e5e0;
    border-radius:8px;
    overflow:hidden;
    border-collapse:separate;
  }
  .client-cell{
    display:table-cell;
    padding:12px 16px;
    border-right:1px solid #e8e5e0;
    vertical-align:top;
    width:33.33%;
    background:#fff;
  }
  .client-cell:last-child{border-right:none;}
  .cell-label{
    font-size:8px;
    font-weight:700;
    letter-spacing:2px;
    text-transform:uppercase;
    color:#bbb;
    display:block;
    margin-bottom:4px;
  }
  .cell-value{
    font-size:12.5px;
    font-weight:500;
    color:#1a1208;
    line-height:1.4;
  }
  .cell-sub{
    font-size:10.5px;
    color:#888;
    margin-top:2px;
    line-height:1.5;
  }

  /* ── Items table ── */
  .table-wrap{
    padding:0 28px 4px;
  }
  .items-table{
    width:100%;
    border-collapse:collapse;
    border:1px solid #ddd;
    border-radius:8px;
    overflow:hidden;
  }
  .items-table thead{display:table-header-group;}
  .items-table thead tr{background:${primary};}
  .items-table thead th{
    padding:9px 12px;
    font-size:8.5px;
    font-weight:700;
    letter-spacing:1.5px;
    text-transform:uppercase;
    color:rgba(255,255,255,.9);
    text-align:left;
  }
  .items-table thead th.th-c{text-align:center;}
  .items-table thead th.th-r{text-align:right;}
  .items-table tbody tr{page-break-inside:avoid;}

  /* ── Bottom section ── */
  .bottom-wrap{
    padding:8px 28px 20px;
    display:table;
    width:100%;
  }
  .bottom-left{display:table-cell;vertical-align:top;padding-right:20px;}
  .bottom-right{display:table-cell;vertical-align:top;width:220px;}

  /* ── Conditions block ── */
  .cond-block{
    background:#f8f7f5;
    border:1px solid #e8e5e0;
    border-radius:8px;
    padding:14px 16px;
    margin-bottom:12px;
  }
  .cond-row{
    display:table;
    width:100%;
    padding:5px 0;
    border-bottom:1px solid #eee;
    font-size:11.5px;
  }
  .cond-row:last-child{border-bottom:none;}
  .cond-key{display:table-cell;color:#888;width:110px;vertical-align:top;}
  .cond-val{display:table-cell;color:#1a1208;font-weight:500;}

  /* ── Totals panel ── */
  .totals{
    border:2px solid #1a1208;
    border-radius:8px;
    overflow:hidden;
  }
  .total-row{
    display:table;
    width:100%;
    padding:9px 14px;
    border-bottom:1px solid #e8e5e0;
    font-size:12px;
  }
  .total-row:last-child{border-bottom:none;}
  .tr-label{display:table-cell;color:#888;}
  .tr-val{display:table-cell;text-align:right;font-weight:600;color:#1a1208;}
  .tr-discount .tr-val{color:#2a6a2a;}
  .total-final{
    background:#1a1208;
    padding:12px 14px;
    display:table;
    width:100%;
  }
  .tf-label{display:table-cell;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.7);}
  .tf-val{display:table-cell;text-align:right;font-size:16px;font-weight:700;color:#fff;}

  /* ── Sign block ── */
  .sign-block{
    display:table;
    width:100%;
    margin-top:16px;
    padding-top:14px;
    border-top:1px solid #e8e5e0;
  }
  .sign-cell{display:table-cell;text-align:center;padding:0 12px;}
  .sign-cell:first-child{padding-left:0;}
  .sign-cell:last-child{padding-right:0;}
  .sign-line{
    border-top:1.5px solid #1a1208;
    padding-top:5px;
    font-size:9.5px;
    color:#aaa;
    letter-spacing:.3px;
  }

  /* ── Notes ── */
  .notes-wrap{padding:0 28px 16px;}
  .notes-box{
    background:#fffdf7;
    border:1px solid #e0d9c8;
    border-left:3px solid #c8b060;
    border-radius:0 6px 6px 0;
    padding:12px 16px;
  }
  .notes-text{font-size:11.5px;color:#555;line-height:1.8;}

  /* ── Footer ── */
  .doc-footer{
    border-top:1px solid #e8e5e0;
    padding:11px 28px;
    display:table;
    width:100%;
    background:#f8f7f5;
  }
  .footer-left{display:table-cell;font-size:9.5px;color:#bbb;vertical-align:middle;}
  .footer-right{display:table-cell;text-align:right;font-size:9.5px;color:#bbb;vertical-align:middle;}
  .footer-right strong{color:#888;}
</style>
</head>
<body>

<!-- Toolbar (hidden on print) -->
<div class="toolbar no-print">
  <button class="btn btn-print" onclick="window.print()">⬇&nbsp; Baixar / Imprimir PDF</button>
  <button class="btn btn-close" onclick="window.close()">Fechar</button>
  <span class="toolbar-title">Orçamento ${budgetNum} · ${companyName}</span>
</div>

<div class="page">

  <!-- Top rule -->
  <div class="rule-top"></div>

  <!-- ─── HEADER ─── -->
  <div class="doc-header">
    <div class="hdr-left">
      <div class="co-block">
        <div class="co-logo">${logoBlock}</div>
        <div class="co-info">
          <div class="co-name">${companyName}</div>
          <div class="co-detail">
            ${companyCnpj  ? `CNPJ: ${companyCnpj}<br>` : ''}
            ${companyPhone ? `${companyPhone}${companyEmail ? ' &nbsp;·&nbsp; ' : '<br>'}` : ''}
            ${companyEmail ? `${companyEmail}<br>` : ''}
            ${companyAddr  ? companyAddr : ''}
          </div>
        </div>
      </div>
    </div>
    <div class="hdr-right">
      <div class="budget-card">
        <span class="bc-label">Orçamento</span>
        <span class="bc-number">${budgetNum}</span>
        <div class="bc-row">Emissão: <span>${createdAt}</span></div>
        ${validUntil !== '—' ? `<div class="bc-row">Válido até: <span>${validUntil}</span></div>` : ''}
      </div>
    </div>
  </div>

  <!-- ─── CLIENTE ─── -->
  <div class="sec-label">Dados do Cliente</div>
  <div class="client-section">
    <div class="client-grid">
      <div class="client-cell">
        <span class="cell-label">Cliente</span>
        <div class="cell-value">${clientName}</div>
      </div>
      <div class="client-cell">
        <span class="cell-label">Contato</span>
        <div class="cell-value">${clientPhone}</div>
        ${clientEmail !== '—' ? `<div class="cell-sub">${clientEmail}</div>` : ''}
      </div>
      <div class="client-cell">
        <span class="cell-label">Localidade</span>
        <div class="cell-value">${clientCity || '—'}</div>
        <div class="cell-sub">Data: ${createdAt}</div>
      </div>
    </div>
  </div>

  <!-- ─── ITENS ─── -->
  <div class="sec-label">Itens do Orçamento</div>
  <div class="table-wrap">
    <table class="items-table">
      <thead>
        <tr>
          <th class="th-c" style="width:30px;">#</th>
          <th>Descrição / Produto</th>
          <th class="th-c" style="width:56px;">Qtd</th>
          <th class="th-r" style="width:96px;">Vlr. Unit.</th>
          <th class="th-r" style="width:96px;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHTML}
      </tbody>
    </table>
  </div>

  <!-- ─── BOTTOM: condições + totais ─── -->
  <div class="bottom-wrap">
    <div class="bottom-left">

      ${(payMethod || validUntil !== '—') ? `
      <div class="cond-block">
        ${payMethod ? `
        <div class="cond-row">
          <span class="cond-key">Pagamento</span>
          <span class="cond-val">${payMethod}</span>
        </div>` : ''}
        ${validUntil !== '—' ? `
        <div class="cond-row">
          <span class="cond-key">Validade</span>
          <span class="cond-val">Até ${validUntil}</span>
        </div>` : ''}
        <div class="cond-row">
          <span class="cond-key">Entrega</span>
          <span class="cond-val">A confirmar após aprovação</span>
        </div>
      </div>` : ''}

      <div class="sign-block">
        <div class="sign-cell">
          <div class="sign-line">Assinatura do cliente</div>
        </div>
        <div class="sign-cell">
          <div class="sign-line">Data de aprovação</div>
        </div>
        <div class="sign-cell">
          <div class="sign-line">Carimbo / CNPJ</div>
        </div>
      </div>
    </div>

    <div class="bottom-right">
      <div class="totals">
        <div class="total-row">
          <span class="tr-label">Subtotal</span>
          <span class="tr-val">${fmt(subtotal)}</span>
        </div>
        ${discount > 0 ? `
        <div class="total-row tr-discount">
          <span class="tr-label">Desconto</span>
          <span class="tr-val">− ${fmt(discount)}</span>
        </div>` : ''}
        <div class="total-final">
          <span class="tf-label">Total</span>
          <span class="tf-val">${fmt(total)}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ─── OBSERVAÇÕES ─── -->
  ${notes ? `
  <div class="sec-label">Observações</div>
  <div class="notes-wrap">
    <div class="notes-box">
      <div class="notes-text">${notes}</div>
    </div>
  </div>` : ''}

  <!-- ─── FOOTER ─── -->
  <div class="doc-footer">
    <div class="footer-left">
      Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      &nbsp;·&nbsp; ${companyName}
    </div>
    <div class="footer-right">
      Sistema <strong>Precy+</strong>
    </div>
  </div>

</div><!-- .page -->

</body>
</html>`

  const win = window.open('', '_blank', 'width=980,height=760')
  if (win) {
    win.document.write(html)
    win.document.close()
    // Focar na janela para impressão mais fácil
    win.focus()
  }
}
