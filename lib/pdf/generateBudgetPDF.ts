/* ============================================================
   PRECY+ — Template PDF Profissional (Estilo Gráfica/ERP)
   Estrutura editorial clean premium, sem aparência web
   ============================================================ */

interface PDFParams {
  budget:  Record<string, unknown>
  items:   Record<string, unknown>[]
  company: Record<string, unknown> | null
}

function fmt(v: unknown) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return '—' }
}

function esc(s: unknown) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')
}

export async function generateBudgetPDF({ budget, items, company }: PDFParams) {
  const primary = String(company?.primary_color ?? '#1a1a1a')

  /* ── Company data ── */
  const co = company as any ?? {}
  const companyName  = esc(co.name  ?? 'Precy+')
  const companyEmail = esc(co.email ?? '')
  const companyPhone = esc(co.phone ?? '')
  const companyCnpj  = esc(co.cnpj  ?? '')
  const companyAddr  = esc(co.address ?? '')
  const companySite  = esc(co.website ?? '')
  const logoUrl      = co.logo_url as string | undefined

  /* ── Budget data ── */
  const budgetNum  = esc(budget.budget_number ?? 'ORC-0001')
  const createdAt  = fmtDate(budget.created_at as string)
  const validUntil = fmtDate(budget.valid_until as string)
  const notes      = esc(budget.notes ?? '')
  const payMethod  = esc((budget as any).payment_method ?? '')
  const subtotal   = Number(budget.subtotal) || items.reduce((s,i) => s + (Number(i.subtotal)||0), 0)
  const discount   = Number(budget.discount) || 0
  const total      = Number(budget.total)    || 0

  /* ── Client data ── */
  const cust = (budget.customers as any) ?? {}
  const clientName  = esc(cust.name  ?? (budget as any).customer_name ?? '—')
  const clientPhone = esc(cust.phone ?? '')
  const clientEmail = esc(cust.email ?? '')
  const clientCity  = esc(cust.city  ?? '')

  /* ── Logo HTML ── */
  const logoHTML = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:56px;max-width:160px;object-fit:contain;">`
    : `<div style="width:56px;height:56px;background:${primary};border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:700;">${String(co.name ?? 'P').charAt(0).toUpperCase()}</div>`

  /* ── Items rows ── */
  const rowsHTML = items.length === 0
    ? `<tr><td colspan="5" style="text-align:center;padding:32px;color:#999;font-size:13px;">Nenhum item adicionado</td></tr>`
    : items.map((item, i) => {
        const name = esc(item.material_name ?? item.name ?? item.product_name ?? 'Item')
        const qty  = Number(item.quantity) || 1
        const up   = Number(item.unit_price) || 0
        const sub  = Number(item.subtotal)   || 0
        return `
        <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
          <td style="padding:10px 12px;border-bottom:1px solid #ebebeb;color:#555;font-size:12px;text-align:center;width:36px;">${i+1}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #ebebeb;font-size:12.5px;color:#1a1a1a;">${name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #ebebeb;text-align:center;font-size:12.5px;color:#333;width:60px;">${qty}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #ebebeb;text-align:right;font-size:12.5px;color:#333;width:100px;">${fmt(up)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #ebebeb;text-align:right;font-size:12.5px;font-weight:600;color:#1a1a1a;width:110px;">${fmt(sub)}</td>
        </tr>`
      }).join('')

  /* ── Totals ── */
  const totalsHTML = `
    <tr>
      <td colspan="3"></td>
      <td style="padding:8px 12px;font-size:12px;color:#666;text-align:right;border-top:1px solid #ddd;">Subtotal</td>
      <td style="padding:8px 12px;font-size:12.5px;font-weight:500;text-align:right;color:#1a1a1a;border-top:1px solid #ddd;">${fmt(subtotal)}</td>
    </tr>
    ${discount > 0 ? `
    <tr>
      <td colspan="3"></td>
      <td style="padding:6px 12px;font-size:12px;color:#666;text-align:right;">Desconto</td>
      <td style="padding:6px 12px;font-size:12.5px;font-weight:500;text-align:right;color:#2a7a2a;">−${fmt(discount)}</td>
    </tr>` : ''}
    <tr style="background:#1a1a1a;">
      <td colspan="3"></td>
      <td style="padding:11px 14px;font-size:12px;font-weight:700;color:rgba(255,255,255,0.8);text-align:right;letter-spacing:0.5px;text-transform:uppercase;">TOTAL</td>
      <td style="padding:11px 14px;font-size:15px;font-weight:700;color:white;text-align:right;">${fmt(total)}</td>
    </tr>`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Orçamento ${budgetNum}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }

  @page {
    size: A4;
    margin: 15mm 12mm 18mm 12mm;
  }

  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    background: #e8e8e8;
    color: #1a1a1a;
    font-size: 13px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Print bar (hidden on print) ── */
  .printbar {
    background: #1a1a1a;
    padding: 12px 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    position: sticky;
    top: 0;
    z-index: 999;
  }
  .printbar button {
    padding: 9px 22px;
    border-radius: 6px;
    border: none;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-print { background: white; color: #1a1a1a; }
  .btn-close { background: transparent; color: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.2) !important; }
  .printbar span { color: rgba(255,255,255,0.5); font-size: 12px; margin-left: auto; }

  @media print {
    body { background: white; }
    .printbar { display: none !important; }
    .page { margin: 0 !important; box-shadow: none !important; }
  }

  /* ── Page ── */
  .page {
    background: white;
    width: 210mm;
    min-height: 297mm;
    margin: 20px auto;
    box-shadow: 0 2px 32px rgba(0,0,0,0.18);
    position: relative;
    overflow: hidden;
  }

  /* ── Top stripe ── */
  .stripe-top {
    height: 5px;
    background: ${primary};
    width: 100%;
  }

  /* ── Header ── */
  .header {
    padding: 24px 32px 20px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    border-bottom: 1px solid #ebebeb;
    gap: 24px;
  }

  .header-left {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    flex: 1;
  }

  .company-meta h1 {
    font-size: 17px;
    font-weight: 700;
    color: #1a1a1a;
    letter-spacing: -0.2px;
    margin-bottom: 5px;
  }

  .company-meta p {
    font-size: 11px;
    color: #888;
    line-height: 1.8;
  }

  /* ── Budget card ── */
  .budget-card {
    flex-shrink: 0;
    border: 1.5px solid #1a1a1a;
    border-radius: 8px;
    padding: 14px 20px;
    text-align: right;
    min-width: 160px;
  }

  .budget-card .doc-type {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: #888;
    margin-bottom: 3px;
  }

  .budget-card .doc-num {
    font-size: 20px;
    font-weight: 700;
    color: #1a1a1a;
    font-family: 'Courier New', monospace;
    letter-spacing: -0.5px;
    margin-bottom: 10px;
  }

  .budget-card .meta-row {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    font-size: 10.5px;
    margin-top: 3px;
  }
  .budget-card .meta-row .meta-label { color: #aaa; }
  .budget-card .meta-row .meta-val   { font-weight: 600; color: #333; }

  /* ── Section label ── */
  .section-label {
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: #aaa;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #ebebeb;
  }

  /* ── Body ── */
  .body { padding: 24px 32px; }

  /* ── Client block ── */
  .client-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1px;
    background: #ebebeb;
    border: 1px solid #ebebeb;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 28px;
  }

  .client-cell {
    background: white;
    padding: 13px 16px;
  }

  .client-cell .cell-label {
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #bbb;
    margin-bottom: 4px;
  }

  .client-cell .cell-value {
    font-size: 12.5px;
    font-weight: 500;
    color: #1a1a1a;
    line-height: 1.4;
  }

  /* ── Table ── */
  .table-wrap {
    margin-bottom: 8px;
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
    page-break-inside: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead { display: table-header-group; }
  tbody { display: table-row-group; }

  thead tr {
    background: #1a1a1a;
  }

  thead th {
    padding: 10px 12px;
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.85);
    text-align: left;
  }

  thead th.th-c { text-align: center; }
  thead th.th-r { text-align: right; }

  tbody tr { page-break-inside: avoid; }

  /* ── Bottom grid ── */
  .bottom-grid {
    display: grid;
    grid-template-columns: 1fr 220px;
    gap: 20px;
    margin-top: 8px;
    margin-bottom: 24px;
    align-items: start;
  }

  .info-block {
    background: #fafafa;
    border: 1px solid #ebebeb;
    border-radius: 8px;
    padding: 16px 18px;
  }

  .info-block .ib-row {
    display: flex;
    gap: 10px;
    margin-bottom: 9px;
  }
  .info-block .ib-row:last-child { margin-bottom: 0; }
  .info-block .ib-label {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #aaa;
    width: 100px;
    flex-shrink: 0;
    padding-top: 1px;
  }
  .info-block .ib-value {
    font-size: 12px;
    color: #333;
    line-height: 1.5;
    flex: 1;
  }

  /* ── Totals panel ── */
  .totals-panel {
    border: 1.5px solid #1a1a1a;
    border-radius: 8px;
    overflow: hidden;
  }

  .totals-panel .tp-row {
    padding: 10px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12.5px;
    border-bottom: 1px solid #ebebeb;
  }
  .totals-panel .tp-row:last-child { border-bottom: none; }
  .tp-row .tp-label { color: #888; }
  .tp-row .tp-val   { font-weight: 600; color: #1a1a1a; }
  .tp-row.tp-discount .tp-val { color: #2a7a2a; }
  .tp-row.tp-total {
    background: #1a1a1a;
    padding: 13px 16px;
  }
  .tp-row.tp-total .tp-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.7);
  }
  .tp-row.tp-total .tp-val {
    font-size: 16px;
    font-weight: 700;
    color: white;
  }

  /* ── Obs ── */
  .obs-block {
    background: #fffef5;
    border: 1px solid #e8e4cc;
    border-left: 3px solid #c8b04a;
    border-radius: 0 6px 6px 0;
    padding: 14px 18px;
    margin-bottom: 24px;
  }
  .obs-block p { font-size: 12px; color: #555; line-height: 1.7; }

  /* ── Signature ── */
  .sign-block {
    margin-top: 28px;
    padding-top: 16px;
    border-top: 1px solid #ebebeb;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
  }
  .sign-line {
    border-top: 1.5px solid #1a1a1a;
    padding-top: 6px;
    font-size: 10px;
    color: #aaa;
    text-align: center;
  }

  /* ── Footer ── */
  .footer {
    padding: 14px 32px;
    border-top: 1px solid #ebebeb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #fafafa;
  }
  .footer p { font-size: 10px; color: #bbb; }
  .footer strong { color: #888; }
</style>
</head>
<body>

<!-- Print toolbar -->
<div class="printbar">
  <button class="btn-print" onclick="window.print()">⬇ Baixar / Imprimir PDF</button>
  <button class="btn-close" onclick="window.close()">Fechar</button>
  <span>Orçamento ${budgetNum} · ${companyName}</span>
</div>

<div class="page">
  <!-- Top stripe -->
  <div class="stripe-top"></div>

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      ${logoHTML}
      <div class="company-meta">
        <h1>${companyName}</h1>
        <p>
          ${companyCnpj  ? `CNPJ: ${companyCnpj}<br>` : ''}
          ${companyPhone ? `Tel: ${companyPhone}<br>` : ''}
          ${companyEmail ? `${companyEmail}<br>` : ''}
          ${companyAddr  ? companyAddr : ''}
        </p>
      </div>
    </div>

    <div class="budget-card">
      <div class="doc-type">Orçamento</div>
      <div class="doc-num">${budgetNum}</div>
      <div class="meta-row">
        <span class="meta-label">Data:</span>
        <span class="meta-val">${createdAt}</span>
      </div>
      ${validUntil !== '—' ? `
      <div class="meta-row">
        <span class="meta-label">Validade:</span>
        <span class="meta-val">${validUntil}</span>
      </div>` : ''}
    </div>
  </div>

  <!-- BODY -->
  <div class="body">

    <!-- CLIENT -->
    <p class="section-label">Dados do Cliente</p>
    <div class="client-grid">
      <div class="client-cell">
        <p class="cell-label">Cliente</p>
        <p class="cell-value">${clientName}</p>
      </div>
      <div class="client-cell">
        <p class="cell-label">Telefone / E-mail</p>
        <p class="cell-value">
          ${clientPhone || '—'}
          ${clientEmail ? `<br><span style="color:#888;font-size:11px;">${clientEmail}</span>` : ''}
        </p>
      </div>
      <div class="client-cell">
        <p class="cell-label">Localidade</p>
        <p class="cell-value">${clientCity || '—'}</p>
      </div>
    </div>

    <!-- ITEMS TABLE -->
    <p class="section-label">Itens do Orçamento</p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:36px;" class="th-c">#</th>
            <th>Descrição / Produto</th>
            <th style="width:60px;" class="th-c">Qtd</th>
            <th style="width:100px;" class="th-r">Vlr. Unit.</th>
            <th style="width:110px;" class="th-r">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
          ${totalsHTML}
        </tbody>
      </table>
    </div>

    <!-- BOTTOM: info + totals -->
    <div class="bottom-grid">
      <div>
        ${(payMethod || validUntil !== '—') ? `
        <p class="section-label" style="margin-top:0;">Condições</p>
        <div class="info-block">
          ${payMethod ? `
          <div class="ib-row">
            <span class="ib-label">Pagamento</span>
            <span class="ib-value">${payMethod}</span>
          </div>` : ''}
          ${validUntil !== '—' ? `
          <div class="ib-row">
            <span class="ib-label">Validade</span>
            <span class="ib-value">Proposta válida até ${validUntil}</span>
          </div>` : ''}
          <div class="ib-row">
            <span class="ib-label">Entrega</span>
            <span class="ib-value">A combinar após aprovação</span>
          </div>
        </div>` : ''}

        <!-- Signature -->
        <div class="sign-block">
          <div>
            <div class="sign-line">Assinatura do Cliente</div>
          </div>
          <div>
            <div class="sign-line">Data de Aprovação</div>
          </div>
        </div>
      </div>

      <div>
        <p class="section-label" style="margin-top:0;">Valores</p>
        <div class="totals-panel">
          <div class="tp-row">
            <span class="tp-label">Subtotal</span>
            <span class="tp-val">${fmt(subtotal)}</span>
          </div>
          ${discount > 0 ? `
          <div class="tp-row tp-discount">
            <span class="tp-label">Desconto</span>
            <span class="tp-val">−${fmt(discount)}</span>
          </div>` : ''}
          <div class="tp-row tp-total">
            <span class="tp-label">TOTAL</span>
            <span class="tp-val">${fmt(total)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- NOTES -->
    ${notes ? `
    <p class="section-label">Observações</p>
    <div class="obs-block">
      <p>${notes}</p>
    </div>` : ''}

  </div>

  <!-- FOOTER -->
  <div class="footer">
    <p>Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} &nbsp;·&nbsp; ${companyName}</p>
    <p>Sistema <strong>Precy+</strong></p>
  </div>
</div>

</body>
</html>`

  const win = window.open('', '_blank', 'width=960,height=760')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
