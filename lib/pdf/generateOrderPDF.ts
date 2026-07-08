/* ============================================================
   PRECY+ — PDF do Pedido
   Visual consistente com generateBudgetPDF.ts
   ============================================================ */

import { formatCurrency } from '@/lib/utils/format'
import { getOrderItems } from '@/lib/pdf/getOrderItems'
import { formatDimDisplay } from '@/lib/utils/dimensions'

interface PaymentRow {
  payment_date: string
  payment_method?: string | null
  amount: number
  observation?: string | null
}

interface PDFParams {
  order:    Record<string, unknown>
  items:    Record<string, unknown>[]
  payments: PaymentRow[]
  company:  Record<string, unknown> | null
}

const R = (v: unknown) => formatCurrency(Number(v) || 0)

const D = (iso?: string | null) => {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return '' }
}

const X = (s: unknown) =>
  String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')

const METHOD_LABELS: Record<string,string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão Crédito',
  cartao_debito: 'Cartão Débito',
  transferencia: 'Transferência',
  boleto: 'Boleto',
  outro: 'Outro',
}
const method = (m?: string | null) => (m ? (METHOD_LABELS[m] ?? m) : '—')

export async function generateOrderPDF({ order, items, payments, company }: PDFParams) {
  const co   = company as any ?? {}
  const o    = order   as any ?? {}
  const cust = o.customers as any ?? {}

  /* ── Empresa ── */
  const coName   = X(co.name    ?? 'Precy+')
  const coEmail  = X(co.email   ?? '')
  const coPhone  = X(co.phone   ?? '')
  const coCnpj   = X(co.cnpj    ?? '')
  const coAddr   = X(co.address ?? '')
  const coInst   = X(co.instagram ?? '')
  const coSite   = X(co.website  ?? '')
  const logoUrl  = co.logo_url as string | undefined
  const primary  = String(co.primary_color ?? '#1a1208')

  /* ── Pedido ── */
  const oNum    = X(o.order_number ?? 'PED-0001')
  const oDate   = D(o.order_date ?? o.created_at)
  const oDue    = D(o.due_date)
  const oNotes  = X(o.notes ?? '')
  const oStatus = String(o.status ?? 'pending')
  const oPayStatus = String(o.payment_status ?? 'pending')
  const oPaidAt = D(o.paid_at)

  /* ── Cliente ── */
  const cName  = X(cust.name     ?? '—')
  const cPhone = X(cust.phone    ?? '')
  const cEmail = X(cust.email    ?? '')
  const cCpf   = X(cust.cpf_cnpj ?? '')
  const cCity  = X(cust.city     ?? '')
  const cState = X(cust.state    ?? '')
  const cAddr  = X(cust.address  ?? '')
  const cLoc   = [cCity, cState].filter(Boolean).join(' — ')

  /* ── Itens — fonte única via getOrderItems ── */
  const effectiveItems = getOrderItems(order, items)

  /* ── Financeiro ── */
  const oSub   = Number(o.subtotal) || effectiveItems.reduce((s, i) => s + (Number(i.subtotal) || 0), 0)
  const oDisc  = Number(o.discount) || 0
  const oFee   = Number(o.delivery_fee) || 0
  const oAdd   = Number(o.additional_charges) || 0
  const oTotal = Number(o.total) || Math.max(0, oSub + oFee + oAdd - oDisc)
  const oReceived = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const oBalance  = Math.max(0, oTotal - oReceived)
  const pctRec    = oTotal > 0 ? Math.min(100, (oReceived / oTotal) * 100) : 0
  const pctPend   = Math.max(0, 100 - pctRec)
  const hasPayments = payments.length > 0

  /* ── Status badges ── */
  const STATUS: Record<string,{label:string;bg:string;fg:string}> = {
    pending:    { label:'Pendente',  bg:'#f0ece6', fg:'#7a6855'  },
    production: { label:'Produção',  bg:'#dbeafe', fg:'#1d4ed8'  },
    ready:      { label:'Pronto',    bg:'#dcfce7', fg:'#15803d'  },
    delivered:  { label:'Entregue',  bg:'#e0e7ff', fg:'#4338ca'  },
    cancelled:  { label:'Cancelado', bg:'#fee2e2', fg:'#b91c1c'  },
  }
  const statusInfo = STATUS[oStatus] ?? STATUS.pending
  const payBadge = oPayStatus === 'paid'
    ? { label:'PAGO INTEGRALMENTE', bg:'#dcfce7', fg:'#15803d' }
    : oPayStatus === 'partial'
    ? { label:'PAGAMENTO PARCIAL',  bg:'#fef9c3', fg:'#a16207' }
    : { label:'NÃO PAGO',           bg:'#f0ece6', fg:'#7a6855' }

  /* ── Logo ── */
  const logoHTML = logoUrl
    ? `<img src="${logoUrl}" alt="${coName}" style="max-height:60px;max-width:160px;object-fit:contain;display:block;">`
    : `<div style="width:54px;height:54px;background:${primary};border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:700;">${String(co.name??'P').charAt(0).toUpperCase()}</div>`

  /* ── Linhas dos itens ── */
  const fmtDim = (item: typeof effectiveItems[0]) => {
    const w = Number(item.width)
    const h = Number(item.height)
    const u = item.measurement_unit ?? 'm'
    if (!w || !h) return ''
    return formatDimDisplay(w, h, u)
  }

  const rowsHTML = effectiveItems.length === 0
    ? `<tr><td colspan="5" style="text-align:center;padding:28px;color:#bbb;font-size:12px;font-style:italic;">Nenhum item cadastrado</td></tr>`
    : effectiveItems.map((item, idx) => {
        const nm   = X(item.name)
        const desc = X(item.description)
        const qty  = Number(item.quantity) || 1
        const up   = Number(item.unit_price) || 0
        const sub  = Number(item.subtotal)   || 0
        const bg   = idx % 2 === 0 ? '#ffffff' : '#faf8f5'
        const dim  = fmtDim(item)
        const fins = (item.finishings ?? []).filter(Boolean)
        const finT = item.finishing_type ?? ''
        const obs  = item.technical_notes ?? ''
        const finTHTML = finT.startsWith('Outros: ')
          ? `Outros: <span style="font-style:italic;">${X(finT.slice(8))}</span>`
          : X(finT)
        return `
        <tr style="background:${bg};page-break-inside:avoid;">
          <td style="padding:11px 10px;border-bottom:1px solid #ede9e3;color:#aaa;font-size:11px;text-align:center;width:28px;vertical-align:top;">${idx+1}</td>
          <td style="padding:11px 14px;border-bottom:1px solid #ede9e3;vertical-align:top;">
            <div style="font-size:13px;font-weight:600;color:#1a1208;line-height:1.35;">${nm}</div>
            ${desc ? `<div style="font-size:11px;color:#9a8a7a;margin-top:3px;line-height:1.5;">${X(desc)}</div>` : ''}
            ${dim ? `<div style="font-size:10.5px;color:#6b7280;margin-top:4px;">📐 Medidas: ${X(dim)}</div>` : ''}
            ${fins.length > 0 ? `<div style="font-size:10.5px;color:#6b7280;margin-top:3px;">✂ Acabamento: ${fins.map(X).join(' · ')}</div>` : ''}
            ${finT ? `<div style="font-size:10.5px;color:#6b7280;margin-top:2px;">📦 Finalização: ${finTHTML}</div>` : ''}
            ${obs ? `<div style="font-size:10px;color:#9a8a7a;margin-top:3px;font-style:italic;">ℹ ${X(obs)}</div>` : ''}
          </td>
          <td style="padding:11px 10px;border-bottom:1px solid #ede9e3;text-align:center;font-size:12.5px;color:#333;width:52px;vertical-align:top;">${qty}</td>
          <td style="padding:11px 10px;border-bottom:1px solid #ede9e3;text-align:right;font-size:12.5px;color:#555;width:92px;vertical-align:top;">${R(up)}</td>
          <td style="padding:11px 14px;border-bottom:1px solid #ede9e3;text-align:right;font-size:13px;font-weight:700;color:#1a1208;width:92px;vertical-align:top;">${R(sub)}</td>
        </tr>`
      }).join('')

  /* ── Tabela de recebimentos ── */
  const paymentsRowsHTML = payments.map((p, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#faf8f5'};">
      <td style="padding:9px 10px;border-bottom:1px solid #ede9e3;font-size:11.5px;color:#333;">${D(p.payment_date)}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #ede9e3;font-size:11.5px;color:#555;">${X(method(p.payment_method))}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #ede9e3;font-size:11.5px;color:#666;">${X(p.observation ?? '')}</td>
      <td style="padding:9px 14px;border-bottom:1px solid #ede9e3;text-align:right;font-size:12px;font-weight:700;color:#166534;">${R(p.amount)}</td>
    </tr>`).join('')

  const paymentsBlockHTML = hasPayments ? `
  <div class="slbl">Recebimentos</div>
  <div class="tw">
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Forma</th>
          <th>Observação</th>
          <th class="th-r" style="width:100px;">Valor</th>
        </tr>
      </thead>
      <tbody>${paymentsRowsHTML}</tbody>
    </table>
  </div>` : ''

  /* ── HTML ── */
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Pedido ${oNum} — ${coName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  @page{size:A4 portrait;margin:13mm 11mm 15mm 11mm;}
  @media print{
    html,body{background:#fff;}
    .no-print{display:none!important;}
    .page{margin:0!important;box-shadow:none!important;width:100%!important;}
  }
  html,body{
    font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
    background:#ddd;color:#1a1208;font-size:13px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  .toolbar{
    background:#1a1208;padding:11px 20px;position:sticky;top:0;z-index:99;
    display:flex;align-items:center;gap:10px;
  }
  .tb-title{color:rgba(255,255,255,.5);font-size:11.5px;margin-left:auto;}
  .btn{padding:8px 18px;border:none;border-radius:6px;font-size:12.5px;
    font-weight:600;cursor:pointer;font-family:inherit;}
  .btn-p{background:#fff;color:#1a1208;}
  .btn-c{background:transparent;color:rgba(255,255,255,.5);
    border:1px solid rgba(255,255,255,.2)!important;}
  .page{
    background:#fff;width:210mm;min-height:297mm;
    margin:20px auto;box-shadow:0 4px 40px rgba(0,0,0,.18);overflow:hidden;
  }
  .stripe{height:4px;background:${primary};}
  .hdr{display:table;width:100%;padding:20px 26px 16px;
    border-bottom:1px solid #ede9e3;}
  .hdr-l{display:table-cell;vertical-align:middle;width:60%;}
  .hdr-r{display:table-cell;vertical-align:top;text-align:right;}
  .co-row{display:table;}
  .co-logo{display:table-cell;vertical-align:middle;padding-right:14px;}
  .co-info{display:table-cell;vertical-align:middle;}
  .co-name{font-size:16px;font-weight:700;color:#1a1208;
    letter-spacing:-.3px;margin-bottom:4px;}
  .co-detail{font-size:10.5px;color:#888;line-height:1.85;}
  .bcard{
    display:inline-block;border:2px solid #1a1208;
    border-radius:8px;padding:12px 16px 10px;min-width:148px;
  }
  .bc-type{font-size:8px;font-weight:700;letter-spacing:3px;
    text-transform:uppercase;color:#999;display:block;margin-bottom:2px;}
  .bc-num{font-size:19px;font-weight:700;color:#1a1208;
    font-family:'Courier New',monospace;display:block;
    letter-spacing:-.5px;margin-bottom:8px;}
  .bc-row{font-size:10px;color:#888;margin-top:2.5px;}
  .bc-row b{color:#1a1208;font-weight:600;}
  .badge{
    display:inline-block;padding:3px 9px;border-radius:20px;
    font-size:9px;font-weight:700;letter-spacing:.5px;
    text-transform:uppercase;margin-top:8px;
  }
  .slbl{
    font-size:8px;font-weight:700;letter-spacing:3px;
    text-transform:uppercase;color:#bbb;
    padding:12px 26px 5px;
    display:flex;align-items:center;gap:8px;
  }
  .slbl::after{content:'';flex:1;height:1px;background:#ede9e3;}
  .cl{padding:0 26px 14px;}
  .cl-grid{display:table;width:100%;
    border:1px solid #ede9e3;border-radius:8px;
    overflow:hidden;border-collapse:separate;}
  .cl-cell{display:table-cell;padding:12px 14px;
    border-right:1px solid #ede9e3;vertical-align:top;width:33.33%;
    background:#fff;}
  .cl-cell:last-child{border-right:none;}
  .lbl{font-size:8px;font-weight:700;letter-spacing:2px;
    text-transform:uppercase;color:#ccc;display:block;margin-bottom:3px;}
  .val{font-size:12.5px;font-weight:500;color:#1a1208;line-height:1.4;}
  .sub{font-size:10.5px;color:#999;margin-top:2px;line-height:1.6;}
  .tw{padding:0 26px 4px;}
  table{width:100%;border-collapse:collapse;
    border:1px solid #ddd;border-radius:8px;overflow:hidden;}
  thead{display:table-header-group;}
  thead tr{background:${primary};}
  thead th{padding:9px 10px;font-size:8.5px;font-weight:700;
    letter-spacing:1.5px;text-transform:uppercase;
    color:rgba(255,255,255,.9);text-align:left;}
  .th-c{text-align:center!important;}
  .th-r{text-align:right!important;}
  tbody tr{page-break-inside:avoid;}
  .bot{display:table;width:100%;padding:6px 26px 18px;}
  .bot-l{display:table-cell;vertical-align:top;padding-right:18px;}
  .bot-r{display:table-cell;vertical-align:top;width:230px;}
  .fin{border:2px solid #1a1208;border-radius:8px;overflow:hidden;}
  .frow{display:table;width:100%;padding:8.5px 14px;
    border-bottom:1px solid #ede9e3;}
  .frow:last-child{border-bottom:none;}
  .fl{display:table-cell;font-size:12px;color:#888;}
  .fv{display:table-cell;text-align:right;font-size:12px;
    font-weight:600;color:#1a1208;}
  .frow.disc .fv{color:#166534;}
  .frow.fee  .fv{color:#555;}
  .ftot{background:#1a1208;padding:11px 14px;display:table;width:100%;}
  .ftl{display:table-cell;font-size:10px;font-weight:700;
    letter-spacing:.8px;text-transform:uppercase;color:rgba(255,255,255,.7);}
  .ftv{display:table-cell;text-align:right;font-size:15px;
    font-weight:700;color:#fff;}
  .fsep{background:#f5f2ee;padding:9px 14px;display:table;
    width:100%;border-top:1px solid #ede9e3;}
  .fsl{display:table-cell;font-size:11px;color:#aaa;}
  .fsv{display:table-cell;text-align:right;font-size:12px;
    font-weight:600;color:#333;}
  .fsv.rem{color:#b91c1c;}
  .pay-status{padding:8px 14px;text-align:center;}
  .obs-w{padding:0 26px 14px;}
  .obs-box{background:#fffdf7;border:1px solid #e0d8c0;
    border-left:3px solid #c8b060;
    border-radius:0 6px 6px 0;padding:12px 16px;}
  .obs-txt{font-size:11.5px;color:#666;line-height:1.8;}
  .footer{border-top:1px solid #ede9e3;padding:12px 26px;
    display:table;width:100%;background:#faf8f5;}
  .fl2{display:table-cell;font-size:9.5px;color:#bbb;vertical-align:middle;}
  .fr2{display:table-cell;text-align:right;font-size:9.5px;
    color:#bbb;vertical-align:middle;}
  .fr2 b{color:#999;}
</style>
</head>
<body>

<div class="toolbar no-print">
  <button class="btn btn-p" onclick="window.print()">⬇ Baixar / Imprimir PDF</button>
  <button class="btn btn-c" onclick="window.close()">Fechar</button>
  <span class="tb-title">Pedido ${oNum} · ${coName}</span>
</div>

<div class="page">
<div class="stripe"></div>

<div class="hdr">
  <div class="hdr-l">
    <div class="co-row">
      <div class="co-logo">${logoHTML}</div>
      <div class="co-info">
        <div class="co-name">${coName}</div>
        <div class="co-detail">
          ${coCnpj  ? `CNPJ: ${coCnpj}<br>`          : ''}
          ${coPhone ? `📞 ${coPhone}<br>`              : ''}
          ${coEmail ? `✉ ${coEmail}<br>`               : ''}
          ${coInst  ? `@${coInst.replace('@','')}<br>` : ''}
          ${coAddr  ? coAddr                            : ''}
        </div>
      </div>
    </div>
  </div>
  <div class="hdr-r">
    <div class="bcard">
      <span class="bc-type">Pedido</span>
      <span class="bc-num">${oNum}</span>
      ${oDate ? `<div class="bc-row">Emissão: <b>${oDate}</b></div>`    : ''}
      ${oDue  ? `<div class="bc-row">Entrega: <b>${oDue}</b></div>` : ''}
      <div>
        <span class="badge" style="background:${statusInfo.bg};color:${statusInfo.fg};">
          ${statusInfo.label}
        </span>
      </div>
    </div>
  </div>
</div>

<div class="slbl">Dados do Cliente</div>
<div class="cl">
  <div class="cl-grid">
    <div class="cl-cell">
      <span class="lbl">Cliente</span>
      <div class="val">${cName}</div>
      ${cCpf  ? `<div class="sub">CPF/CNPJ: ${cCpf}</div>` : ''}
      ${cAddr ? `<div class="sub">${cAddr}</div>`           : ''}
    </div>
    <div class="cl-cell">
      <span class="lbl">Contato</span>
      <div class="val">${cPhone || '—'}</div>
      ${cEmail ? `<div class="sub">${cEmail}</div>` : ''}
    </div>
    <div class="cl-cell">
      <span class="lbl">Localidade</span>
      <div class="val">${cLoc || '—'}</div>
      ${oDate ? `<div class="sub">Emitido em ${oDate}</div>` : ''}
    </div>
  </div>
</div>

<div class="slbl">Itens do Pedido</div>
<div class="tw">
  <table>
    <thead>
      <tr>
        <th class="th-c" style="width:28px;">#</th>
        <th>Produto / Descrição</th>
        <th class="th-c" style="width:52px;">Qtd</th>
        <th class="th-r" style="width:92px;">Vlr. Unit.</th>
        <th class="th-r" style="width:92px;">Subtotal</th>
      </tr>
    </thead>
    <tbody>${rowsHTML}</tbody>
  </table>
</div>

${paymentsBlockHTML}

<div class="bot">
  <div class="bot-l"></div>
  <div class="bot-r">
    <div class="fin">
      <div class="frow">
        <span class="fl">Subtotal</span>
        <span class="fv">${R(oSub)}</span>
      </div>
      ${oFee > 0 ? `
      <div class="frow fee">
        <span class="fl">Frete</span>
        <span class="fv">+ ${R(oFee)}</span>
      </div>` : ''}
      ${oAdd > 0 ? `
      <div class="frow fee">
        <span class="fl">Acréscimos</span>
        <span class="fv">+ ${R(oAdd)}</span>
      </div>` : ''}
      ${oDisc > 0 ? `
      <div class="frow disc">
        <span class="fl">Desconto</span>
        <span class="fv">− ${R(oDisc)}</span>
      </div>` : ''}
      <div class="ftot">
        <span class="ftl">Total</span>
        <span class="ftv">${R(oTotal)}</span>
      </div>
      ${hasPayments ? `
      <div class="fsep">
        <span class="fsl" style="color:#166534;font-weight:600;">✓ Recebido (${pctRec.toFixed(2).replace('.', ',')}%)</span>
        <span class="fsv" style="color:#166534;">${R(oReceived)}</span>
      </div>
      <div class="fsep">
        <span class="fsl" style="color:#b91c1c;font-weight:600;">Saldo (${pctPend.toFixed(2).replace('.', ',')}%)</span>
        <span class="fsv rem">${R(oBalance)}</span>
      </div>` : ''}
      <div class="pay-status">
        <span class="badge" style="background:${payBadge.bg};color:${payBadge.fg};font-size:9.5px;padding:4px 12px;">
          ${payBadge.label}
        </span>
        ${oPayStatus === 'paid' && oPaidAt ? `<div style="font-size:9.5px;color:#999;margin-top:6px;">Quitado em ${oPaidAt}</div>` : ''}
      </div>
    </div>
  </div>
</div>

${oNotes ? `
<div class="slbl">Observações</div>
<div class="obs-w">
  <div class="obs-box">
    <div class="obs-txt">${oNotes}</div>
  </div>
</div>` : ''}

<div class="footer">
  <div class="fl2">
    ${coName}
    ${coInst ? ` · @${coInst.replace('@','')}` : ''}
    ${coSite ? ` · ${coSite}` : ''}
  </div>
  <div class="fr2">
    Gerado em ${new Date().toLocaleDateString('pt-BR')} &nbsp;·&nbsp; <b>Precy+</b>
  </div>
</div>

</div><!-- .page -->
</body>
</html>`

  const win = window.open('', '_blank', 'width=980,height=760')
  if (win) { win.document.write(html); win.document.close(); win.focus() }
}
