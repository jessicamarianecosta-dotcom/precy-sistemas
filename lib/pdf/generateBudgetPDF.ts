/* ============================================================
   PRECY+ — PDF Premium v4
   Visual: ERP / Gráfica Profissional / Proposta Comercial
   ============================================================ */

import { formatCurrency } from '@/lib/utils/format'
import { getBudgetItems } from '@/lib/pdf/getBudgetItems'

interface PDFParams {
  budget:  Record<string, unknown>
  items:   Record<string, unknown>[]
  company: Record<string, unknown> | null
}

const R = (v: unknown) => formatCurrency(Number(v) || 0)

const D = (iso?: string | null) => {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return '' }
}

const X = (s: unknown) =>
  String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')

export async function generateBudgetPDF({ budget, items, company }: PDFParams) {
  const co   = company as any ?? {}
  const b    = budget  as any ?? {}
  const cust = b.customers as any ?? {}

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

  /* ── Orçamento ── */
  const bNum    = X(b.budget_number ?? 'ORC-0001')
  const bDate   = D(b.created_at)
  const bValid  = D(b.valid_until)
  const bNotes  = X(b.notes ?? '')
  const bStatus = String(b.status ?? 'draft')
  const bPay        = X(b.payment_method   ?? '')
  const bPayCond    = X(b.pay_condition    ?? '')   // avista | parcelado | entrada | prazo
  const bInstall    = Number(b.installments) || 0
  const bSigAmount  = Number(b.signal_amount) || Number(b.signal_amt) || 0
  const bDelTyp = X(b.delivery_type   ?? '')
  const bDelFee = Number(b.delivery_fee)  || 0
  const bDelAdr = X(b.delivery_addr   ?? '')
  const bDelDay = X(b.delivery_days   ?? '')
  const bPrdDay = X(b.production_days ?? '')

  /* ── Financeiro ── */
  const bSub  = Number(b.subtotal) || items.reduce((s,i) => s + (Number(i.subtotal)||0), 0)
  const bDisc = Number(b.discount) || 0
  const bFee  = bDelFee
  const bTot  = Number(b.total) || Math.max(0, bSub + bFee - bDisc)
  const bSig  = bSigAmount
  const bRem  = Math.max(0, bTot - bSig)

  /* ── Cliente ── */
  const cName  = X(cust.name     ?? '—')
  const cPhone = X(cust.phone    ?? '')
  const cEmail = X(cust.email    ?? '')
  const cCpf   = X(cust.cpf_cnpj ?? '')
  const cCity  = X(cust.city     ?? '')
  const cState = X(cust.state    ?? '')
  const cAddr  = X(cust.address  ?? '')
  const cLoc   = [cCity, cState].filter(Boolean).join(' — ')

  /* ── Status badges ── */
  const STATUS: Record<string,{label:string;bg:string;fg:string}> = {
    draft:     { label:'Rascunho',   bg:'#f0ece6', fg:'#7a6855'  },
    sent:      { label:'Enviado',    bg:'#dbeafe', fg:'#1d4ed8'  },
    approved:  { label:'Aprovado',   bg:'#dcfce7', fg:'#15803d'  },
    rejected:  { label:'Recusado',  bg:'#fee2e2', fg:'#b91c1c'  },
    converted: { label:'Convertido', bg:'#fef9c3', fg:'#a16207'  },
  }
  const statusInfo = STATUS[bStatus] ?? STATUS.draft
  const payBadge = bSig >= bTot && bTot > 0
    ? { label:'PAGO',              bg:'#dcfce7', fg:'#15803d' }
    : bSig > 0
    ? { label:'PAGAMENTO PARCIAL', bg:'#fef9c3', fg:'#a16207' }
    : { label:'PENDENTE',          bg:'#f0ece6', fg:'#7a6855' }

  /* ── Logo ── */
  const logoHTML = logoUrl
    ? `<img src="${logoUrl}" alt="${coName}" style="max-height:60px;max-width:160px;object-fit:contain;display:block;">`
    : `<div style="width:54px;height:54px;background:${primary};border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:700;">${String(co.name??'P').charAt(0).toUpperCase()}</div>`

  /* ── Itens — fonte única via getBudgetItems ── */
  const effectiveItems = getBudgetItems(budget, items)

  const fmtDim = (item: typeof effectiveItems[0]) => {
    const w = Number(item.width)
    const h = Number(item.height)
    const a = Number(item.area) || (w && h ? w * h : 0)
    const u = item.measurement_unit ?? 'm'
    if (!w && !h) return ''
    const fmt2 = (v: number) => v % 1 === 0 ? String(v) : v.toFixed(2).replace('.',',')
    let line = `${fmt2(w)} × ${fmt2(h)} ${u}`
    if (a > 0) line += ` · Área: ${a.toFixed(4).replace('.',',')} m²`
    return line
  }

  const rowsHTML = effectiveItems.length === 0
    ? `<tr><td colspan="5" style="text-align:center;padding:28px;color:#bbb;font-size:12px;font-style:italic;">Nenhum item cadastrado</td></tr>`
    : effectiveItems.map((item,idx) => {
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
        return `
        <tr style="background:${bg};page-break-inside:avoid;">
          <td style="padding:11px 10px;border-bottom:1px solid #ede9e3;color:#aaa;font-size:11px;text-align:center;width:28px;vertical-align:top;">${idx+1}</td>
          <td style="padding:11px 14px;border-bottom:1px solid #ede9e3;vertical-align:top;">
            <div style="font-size:13px;font-weight:600;color:#1a1208;line-height:1.35;">${nm}</div>
            ${desc ? `<div style="font-size:11px;color:#9a8a7a;margin-top:3px;line-height:1.5;">${X(desc)}</div>` : ''}
            ${dim ? `<div style="font-size:10.5px;color:#6b7280;margin-top:4px;">📐 ${X(dim)}</div>` : ''}
            ${fins.length > 0 ? `<div style="font-size:10.5px;color:#6b7280;margin-top:3px;">✂ ${fins.map(X).join(' · ')}</div>` : ''}
            ${finT ? `<div style="font-size:10.5px;color:#6b7280;margin-top:2px;">📦 ${X(finT)}</div>` : ''}
            ${obs ? `<div style="font-size:10px;color:#9a8a7a;margin-top:3px;font-style:italic;">ℹ ${X(obs)}</div>` : ''}
          </td>
          <td style="padding:11px 10px;border-bottom:1px solid #ede9e3;text-align:center;font-size:12.5px;color:#333;width:52px;vertical-align:top;">${qty}</td>
          <td style="padding:11px 10px;border-bottom:1px solid #ede9e3;text-align:right;font-size:12.5px;color:#555;width:92px;vertical-align:top;">${R(up)}</td>
          <td style="padding:11px 14px;border-bottom:1px solid #ede9e3;text-align:right;font-size:13px;font-weight:700;color:#1a1208;width:92px;vertical-align:top;">${R(sub)}</td>
        </tr>`
      }).join('')

  /* ── HTML ── */
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Orçamento ${bNum} — ${coName}</title>
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
  /* stripe */
  .stripe{height:4px;background:${primary};}
  /* header */
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
  /* budget card */
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
  /* section label */
  .slbl{
    font-size:8px;font-weight:700;letter-spacing:3px;
    text-transform:uppercase;color:#bbb;
    padding:12px 26px 5px;
    display:flex;align-items:center;gap:8px;
  }
  .slbl::after{content:'';flex:1;height:1px;background:#ede9e3;}
  /* client */
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
  /* table */
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
  /* bottom */
  .bot{display:table;width:100%;padding:6px 26px 18px;}
  .bot-l{display:table-cell;vertical-align:top;padding-right:18px;}
  .bot-r{display:table-cell;vertical-align:top;width:230px;}
  /* cond block */
  .cblock{background:#faf8f5;border:1px solid #ede9e3;
    border-radius:8px;padding:13px 15px;margin-bottom:10px;}
  .crow{display:table;width:100%;padding:4.5px 0;
    border-bottom:1px solid #f0ece6;font-size:11.5px;}
  .crow:last-child{border-bottom:none;}
  .ck{display:table-cell;color:#aaa;width:108px;vertical-align:top;
    padding-top:1px;}
  .cv{display:table-cell;color:#333;font-weight:500;}
  /* financial panel */
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
  /* sign */
  .sign{margin-top:16px;padding-top:12px;border-top:1px solid #ede9e3;
    display:table;width:100%;}
  .sc{display:table-cell;text-align:center;padding:0 10px;}
  .sc:first-child{padding-left:0;}
  .sc:last-child{padding-right:0;}
  .sl{border-top:1.5px solid #1a1208;padding-top:5px;
    font-size:9px;color:#bbb;letter-spacing:.3px;}
  /* obs */
  .obs-w{padding:0 26px 14px;}
  .obs-box{background:#fffdf7;border:1px solid #e0d8c0;
    border-left:3px solid #c8b060;
    border-radius:0 6px 6px 0;padding:12px 16px;}
  .obs-txt{font-size:11.5px;color:#666;line-height:1.8;}
  /* footer */
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
  <span class="tb-title">Orçamento ${bNum} · ${coName}</span>
</div>

<div class="page">
<div class="stripe"></div>

<!-- ── HEADER ── -->
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
      <span class="bc-type">Orçamento</span>
      <span class="bc-num">${bNum}</span>
      ${bDate  ? `<div class="bc-row">Emissão: <b>${bDate}</b></div>`    : ''}
      ${bValid ? `<div class="bc-row">Válido até: <b>${bValid}</b></div>` : ''}
      <div>
        <span class="badge" style="background:${statusInfo.bg};color:${statusInfo.fg};">
          ${statusInfo.label}
        </span>
      </div>
    </div>
  </div>
</div>

<!-- ── CLIENTE ── -->
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
      ${bDate ? `<div class="sub">Emitido em ${bDate}</div>` : ''}
    </div>
  </div>
</div>

<!-- ── ITENS ── -->
<div class="slbl">Itens do Orçamento</div>
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

<!-- ── BOTTOM: CONDIÇÕES + FINANCEIRO ── -->
<div class="bot">

  <!-- Esquerda: condições + assinatura -->
  <div class="bot-l">
    ${(bPay || bPayCond || bDelTyp || bDelDay || bPrdDay || bValid) ? `
    <div class="cblock">
      ${(bPay || bPayCond) ? `
      <div class="crow">
        <span class="ck">Pagamento</span>
        <span class="cv">${(() => {
          const base = bPay || ''
          if (bPayCond === 'avista')
            return (base ? base + ' — ' : '') + 'À vista'
          if (bPayCond === 'parcelado' && bInstall > 1)
            return (base ? base + ' — ' : '') + bInstall + 'x de ' + R(bTot / bInstall)
          if (bPayCond === 'entrada' && bSig > 0) {
            const pct = bTot > 0 ? Math.round((bSig/bTot)*100*10)/10 : 0
            return (base ? base + ' — ' : '') + 'Entrada de ' + R(bSig) + ' (' + pct + '%)'
          }
          if (bPayCond === 'prazo')
            return (base ? base + ' — ' : '') + 'A prazo'
          return base || bPayCond
        })()}</span>
      </div>` : ''}
      ${bSig > 0 ? (() => {
        const pct = bTot > 0 ? Math.round((bSig/bTot)*100*10)/10 : 0
        const rem = Math.max(0, bTot - bSig)
        const remPct = Math.round((100-pct)*10)/10
        return `
      <div class="crow">
        <span class="ck" style="color:#166534;font-weight:600;">✓ Sinal/entrada recebido (${pct}%)</span>
        <span class="cv" style="color:#166534;font-weight:600;">${R(bSig)}</span>
      </div>
      <div class="crow">
        <span class="ck" style="color:#b91c1c;">Saldo pendente (${remPct}%)</span>
        <span class="cv" style="color:#b91c1c;font-weight:600;">${R(rem)}</span>
      </div>`
      })() : ''}
      ${bDelTyp ? `
      <div class="crow">
        <span class="ck">Entrega</span>
        <span class="cv">${
          bDelTyp==='pickup'   ? 'Retirada no local'    :
          bDelTyp==='delivery' ? 'Entrega'              :
          bDelTyp==='motoboy'  ? 'Motoboy'              :
          bDelTyp==='correios' ? 'Correios'             :
          bDelTyp==='carrier'  ? 'Transportadora'       : bDelTyp
        }${bDelAdr ? ' — '+bDelAdr : ''}${bDelFee > 0 ? ' · frete '+R(bDelFee) : ''}</span>
      </div>` : ''}
      ${bPrdDay ? `
      <div class="crow">
        <span class="ck">Produção</span>
        <span class="cv">${bPrdDay}</span>
      </div>` : ''}
      ${bDelDay ? `
      <div class="crow">
        <span class="ck">Prazo entrega</span>
        <span class="cv">${bDelDay}</span>
      </div>` : ''}
      ${bValid ? `
      <div class="crow">
        <span class="ck">Validade proposta</span>
        <span class="cv">${bValid}</span>
      </div>` : ''}
    </div>` : ''}

    <div class="sign">
      <div class="sc"><div class="sl">Assinatura do cliente</div></div>
      <div class="sc"><div class="sl">Data de aprovação</div></div>
      <div class="sc"><div class="sl">Carimbo / CNPJ</div></div>
    </div>
  </div>

  <!-- Direita: painel financeiro -->
  <div class="bot-r">
    <div class="fin">
      <div class="frow">
        <span class="fl">Subtotal</span>
        <span class="fv">${R(bSub)}</span>
      </div>
      ${bFee > 0 ? `
      <div class="frow fee">
        <span class="fl">Frete</span>
        <span class="fv">+ ${R(bFee)}</span>
      </div>` : ''}
      ${bDisc > 0 ? `
      <div class="frow disc">
        <span class="fl">Desconto</span>
        <span class="fv">− ${R(bDisc)}</span>
      </div>` : ''}
      <div class="ftot">
        <span class="ftl">Total</span>
        <span class="ftv">${R(bTot)}</span>
      </div>
      ${bSig > 0 ? (() => {
        const pct = bTot > 0 ? Math.round((bSig/bTot)*100*10)/10 : 0
        const remPct = Math.round((100-pct)*10)/10
        return `
      <div class="fsep">
        <span class="fsl" style="color:#166534;font-weight:600;">✓ Sinal recebido (${pct}%)</span>
        <span class="fsv" style="color:#166534;">${R(bSig)}</span>
      </div>
      <div class="fsep">
        <span class="fsl" style="color:#b91c1c;font-weight:600;">Saldo a pagar (${remPct}%)</span>
        <span class="fsv rem">${R(bRem)}</span>
      </div>`
      })() : ''}
      <div class="pay-status">
        <span class="badge" style="background:${payBadge.bg};color:${payBadge.fg};font-size:9.5px;padding:4px 12px;">
          ${payBadge.label}
        </span>
      </div>
    </div>
  </div>

</div>

<!-- ── OBSERVAÇÕES ── -->
${bNotes ? `
<div class="slbl">Observações</div>
<div class="obs-w">
  <div class="obs-box">
    <div class="obs-txt">${bNotes}</div>
  </div>
</div>` : ''}

<!-- ── FOOTER ── -->
<div class="footer">
  <div class="fl2">
    ${coName}
    ${coInst ? ` · @${coInst.replace('@','')}` : ''}
    ${coSite ? ` · ${coSite}` : ''}
    &nbsp;·&nbsp;
    Orçamento válido ${bValid ? 'até '+bValid : 'conforme condições acima'}
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
