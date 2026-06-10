/* ============================================================
   PRECY+ — Gerador de PDF Premium para Orçamentos
   Abordagem: HTML template → window.print() → PDF via browser
   ============================================================ */

interface PDFParams {
  budget:  Record<string, unknown>
  items:   Record<string, unknown>[]
  company: Record<string, unknown> | null
}

function fmt(v: number | unknown) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return '—' }
}

export async function generateBudgetPDF({ budget, items, company }: PDFParams) {
  const primary   = String(company?.primary_color   ?? '#8B6C4F')
  const secondary = String(company?.secondary_color ?? '#B8956A')

  const companyName = String(company?.name ?? 'Precy+')
  const companyEmail = String(company?.email ?? '')
  const companyPhone = String((company as any)?.phone ?? '')
  const companyCnpj  = String((company as any)?.cnpj  ?? '')
  const companyAddr  = String((company as any)?.address ?? '')
  const logoUrl      = (company as any)?.logo_url as string | undefined

  const budgetNum  = String(budget.budget_number || 'ORC-0001')
  const createdAt  = fmtDate(budget.created_at as string)
  const validUntil = fmtDate(budget.valid_until as string)
  const notes      = String(budget.notes ?? '')
  const discount   = Number(budget.discount) || 0
  const total      = Number(budget.total)    || 0
  const subtotal   = Number(budget.subtotal) || items.reduce((s, i) => s + (Number(i.subtotal) || 0), 0)

  const customer = (budget.customers as any) ?? {}
  const clientName  = String(customer.name  ?? (budget as any).customer_name ?? '—')
  const clientPhone = String(customer.phone ?? '')
  const clientEmail = String(customer.email ?? '')

  const logoHTML = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" class="company-logo" />`
    : `<div class="logo-text">${companyName.charAt(0)}</div>`

  const rowsHTML = items.map((item, i) => `
    <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td class="td-num">${i + 1}</td>
      <td class="td-desc">
        <div class="item-name">${String(item.material_name ?? item.name ?? item.product_name ?? 'Item')}</div>
      </td>
      <td class="td-center">${Number(item.quantity) || 1}</td>
      <td class="td-right">${fmt(item.unit_price)}</td>
      <td class="td-right td-total">${fmt(item.subtotal)}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Orçamento ${budgetNum}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f5f5f5;
      color: #1a1208;
      font-size: 13px;
      line-height: 1.5;
    }

    .page {
      background: white;
      width: 210mm;
      min-height: 297mm;
      margin: 20px auto;
      padding: 0;
      box-shadow: 0 4px 40px rgba(0,0,0,0.12);
      position: relative;
    }

    /* ── HEADER ── */
    .header {
      background: ${primary};
      padding: 28px 32px 24px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .company-logo {
      width: 64px;
      height: 64px;
      object-fit: contain;
      border-radius: 12px;
      background: rgba(255,255,255,0.15);
      padding: 4px;
    }

    .logo-text {
      width: 64px;
      height: 64px;
      background: rgba(255,255,255,0.2);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
    }

    .company-info h1 {
      font-size: 20px;
      font-weight: 700;
      color: white;
      letter-spacing: -0.3px;
    }

    .company-info p {
      font-size: 11px;
      color: rgba(255,255,255,0.75);
      margin-top: 2px;
      line-height: 1.6;
    }

    .header-right {
      text-align: right;
      flex-shrink: 0;
    }

    .budget-badge {
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 8px;
      padding: 8px 16px;
      display: inline-block;
      margin-bottom: 8px;
    }

    .budget-badge .label {
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.7);
    }

    .budget-badge .number {
      font-size: 18px;
      font-weight: 700;
      color: white;
      font-family: monospace;
    }

    .header-meta p {
      font-size: 11px;
      color: rgba(255,255,255,0.7);
      text-align: right;
    }

    .header-meta span {
      color: white;
      font-weight: 500;
    }

    /* ── ACCENT BAR ── */
    .accent-bar {
      height: 4px;
      background: linear-gradient(90deg, ${primary}, ${secondary}, ${primary}40);
    }

    /* ── BODY ── */
    .body {
      padding: 28px 32px;
    }

    /* ── SECTION TITLE ── */
    .section-title {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: ${primary};
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1.5px solid ${primary}20;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .section-title::before {
      content: '';
      display: inline-block;
      width: 3px;
      height: 14px;
      background: ${primary};
      border-radius: 2px;
    }

    /* ── CLIENT SECTION ── */
    .client-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 28px;
    }

    .info-card {
      background: #faf7f4;
      border: 1px solid #ede8e2;
      border-radius: 10px;
      padding: 16px;
    }

    .info-card p {
      font-size: 12px;
      color: #5a4a3b;
      margin-bottom: 4px;
    }

    .info-card .field-label {
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #b8a898;
      margin-bottom: 2px;
    }

    .info-card .field-value {
      font-size: 13px;
      font-weight: 500;
      color: #1a1208;
      margin-bottom: 0;
    }

    /* ── ITEMS TABLE ── */
    .table-wrap {
      margin-bottom: 24px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #ede8e2;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead tr {
      background: ${primary};
    }

    thead th {
      padding: 10px 12px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.9);
      text-align: left;
    }

    thead th.th-right  { text-align: right; }
    thead th.th-center { text-align: center; }

    .row-even { background: white; }
    .row-odd  { background: #faf7f4; }

    td {
      padding: 10px 12px;
      font-size: 12px;
      color: #3a2d22;
      border-bottom: 1px solid #f0ece6;
      vertical-align: middle;
    }

    tr:last-child td { border-bottom: none; }

    .td-num    { width: 32px; color: #b8a898; font-size: 11px; text-align: center; }
    .td-desc   { min-width: 200px; }
    .td-center { text-align: center; width: 60px; }
    .td-right  { text-align: right; width: 90px; }
    .td-total  { font-weight: 600; color: ${primary}; }

    .item-name { font-weight: 500; color: #1a1208; }

    /* ── TOTALS ── */
    .totals-grid {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 24px;
    }

    .totals-box {
      width: 260px;
      background: #faf7f4;
      border: 1px solid #ede8e2;
      border-radius: 10px;
      overflow: hidden;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 9px 16px;
      border-bottom: 1px solid #ede8e2;
      font-size: 12px;
    }

    .total-row:last-child { border-bottom: none; }
    .total-row .label { color: #7a6855; }
    .total-row .value { font-weight: 500; color: #1a1208; }

    .total-row.final {
      background: ${primary};
      padding: 13px 16px;
    }
    .total-row.final .label { color: rgba(255,255,255,0.8); font-weight: 600; font-size: 13px; }
    .total-row.final .value { color: white; font-weight: 700; font-size: 16px; }

    /* ── BOTTOM SECTIONS ── */
    .bottom-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }

    /* ── NOTES ── */
    .notes-box {
      background: #fffdf9;
      border: 1px solid #ede8e2;
      border-left: 3px solid ${secondary};
      border-radius: 0 8px 8px 0;
      padding: 14px 16px;
      margin-bottom: 24px;
    }

    .notes-box p {
      font-size: 11.5px;
      color: #5a4a3b;
      line-height: 1.7;
    }

    /* ── FOOTER ── */
    .footer {
      border-top: 1px solid #ede8e2;
      padding: 16px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .footer-left p {
      font-size: 10px;
      color: #b8a898;
    }

    .footer-brand {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      color: #b8a898;
    }

    .footer-brand strong { color: ${primary}; }

    /* ── PRINT ── */
    @media print {
      body { background: white; }
      .page {
        margin: 0;
        box-shadow: none;
        width: 100%;
      }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <!-- Print button -->
  <div class="no-print" style="display:flex;justify-content:center;gap:12px;padding:16px;background:#f0ece6;">
    <button onclick="window.print()"
      style="background:${primary};color:white;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">
      ⬇ Baixar / Imprimir PDF
    </button>
    <button onclick="window.close()"
      style="background:white;color:#7a6855;border:1px solid #ede8e2;padding:10px 20px;border-radius:8px;font-size:14px;cursor:pointer;font-family:inherit;">
      Fechar
    </button>
  </div>

  <div class="page">
    <!-- HEADER -->
    <div class="header">
      <div class="header-left">
        ${logoHTML}
        <div class="company-info">
          <h1>${companyName}</h1>
          <p>
            ${companyCnpj  ? `CNPJ: ${companyCnpj}<br>` : ''}
            ${companyPhone ? `${companyPhone}<br>` : ''}
            ${companyEmail ? `${companyEmail}<br>` : ''}
            ${companyAddr  ? companyAddr : ''}
          </p>
        </div>
      </div>
      <div class="header-right">
        <div class="budget-badge">
          <div class="label">Orçamento</div>
          <div class="number">${budgetNum}</div>
        </div>
        <div class="header-meta">
          <p>Data: <span>${createdAt}</span></p>
          ${validUntil !== '—' ? `<p>Válido até: <span>${validUntil}</span></p>` : ''}
        </div>
      </div>
    </div>

    <div class="accent-bar"></div>

    <div class="body">
      <!-- CLIENT -->
      <p class="section-title">Dados do Cliente</p>
      <div class="client-grid">
        <div class="info-card">
          <p class="field-label">Cliente</p>
          <p class="field-value">${clientName}</p>
          ${clientPhone ? `<p class="field-label" style="margin-top:10px">Telefone</p><p class="field-value">${clientPhone}</p>` : ''}
        </div>
        <div class="info-card">
          ${clientEmail ? `<p class="field-label">E-mail</p><p class="field-value">${clientEmail}</p>` : ''}
          <p class="field-label" style="margin-top:${clientEmail ? '10px' : '0'}">Data do Orçamento</p>
          <p class="field-value">${createdAt}</p>
        </div>
      </div>

      <!-- ITEMS -->
      <p class="section-title">Itens do Orçamento</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="th-center">#</th>
              <th>Descrição / Produto</th>
              <th class="th-center">Qtd</th>
              <th class="th-right">Valor Unit.</th>
              <th class="th-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML || '<tr><td colspan="5" style="text-align:center;padding:24px;color:#b8a898;">Nenhum item</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- TOTALS -->
      <div class="totals-grid">
        <div class="totals-box">
          <div class="total-row">
            <span class="label">Subtotal</span>
            <span class="value">${fmt(subtotal)}</span>
          </div>
          ${discount > 0 ? `
          <div class="total-row">
            <span class="label">Desconto</span>
            <span class="value" style="color:#5c8b4f;">−${fmt(discount)}</span>
          </div>` : ''}
          <div class="total-row final">
            <span class="label">TOTAL FINAL</span>
            <span class="value">${fmt(total)}</span>
          </div>
        </div>
      </div>

      <!-- BOTTOM SECTIONS -->
      <div class="bottom-grid">
        <div class="info-card">
          <p class="section-title" style="margin-bottom:8px;">Condições de Pagamento</p>
          <p class="field-label">Forma</p>
          <p class="field-value" style="margin-bottom:8px;">${(budget as any).payment_method || 'A combinar'}</p>
          ${validUntil !== '—' ? `
          <p class="field-label">Validade da Proposta</p>
          <p class="field-value">${validUntil}</p>` : ''}
        </div>
        <div class="info-card">
          <p class="section-title" style="margin-bottom:8px;">Entrega / Logística</p>
          <p class="field-value" style="color:#7a6855;font-size:12px;">
            Prazo e condições de entrega a confirmar após aprovação do orçamento.
          </p>
          <div style="margin-top:16px;padding-top:12px;border-top:1px solid #ede8e2;">
            <p class="field-label">Área de Assinatura</p>
            <div style="height:28px;border-bottom:1.5px solid #1a1208;margin-top:6px;"></div>
            <p style="font-size:10px;color:#b8a898;margin-top:4px;text-align:center;">
              Assinatura e carimbo do cliente
            </p>
          </div>
        </div>
      </div>

      <!-- NOTES -->
      ${notes ? `
      <p class="section-title">Observações</p>
      <div class="notes-box">
        <p>${notes.replace(/\n/g, '<br>')}</p>
      </div>` : ''}
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-left">
        <p>Orçamento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
        <p>Este documento é válido conforme condições descritas acima.</p>
      </div>
      <div class="footer-brand">
        Gerado por <strong>Precy+</strong>
      </div>
    </div>
  </div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
