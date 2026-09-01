/* ============================================================
   PRECY+ — Ficha de Produção
   Visual consistente com generateOrderPDF.ts, porém SEM nenhuma
   informação financeira (preço, subtotal, total, forma de
   pagamento, desconto, status de pagamento). Uso exclusivo da
   produção/gráfica.
   ============================================================ */

import QRCode from 'qrcode'
import { getOrderItems } from '@/lib/pdf/getOrderItems'
import { formatDimDisplay } from '@/lib/utils/dimensions'
import { getFileKind, getDownloadUrl } from '@/lib/utils/fileIcons'
import type { OrderFile } from '@/components/orders/types'

interface PDFParams {
  order:     Record<string, unknown>
  items:     Record<string, unknown>[]
  company:   Record<string, unknown> | null
  artFiles?: OrderFile[]
}

const D = (iso?: string | null) => {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return '' }
}

const X = (s: unknown) =>
  String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')

const CHECKLIST = [
  'Arte conferida',
  'Cliente aprovou',
  'Produção iniciada',
  'Impressão',
  'Corte',
  'Acabamento',
  'Embalagem',
  'Entregue',
]

export async function generateProductionSheet({ order, items, company, artFiles }: PDFParams) {
  const co   = company as any ?? {}
  const o    = order   as any ?? {}
  const cust = o.customers as any ?? {}

  /* ── Empresa ── */
  const coName  = X(co.name ?? 'Precy+')
  const logoUrl = co.logo_url as string | undefined
  const primary = String(co.primary_color ?? '#1a1208')

  /* ── Pedido ── */
  const oNum   = X(o.order_number ?? 'PED-0001')
  const oDate  = D(o.order_date ?? o.created_at)
  const oDue   = D(o.due_date)
  const oNotes = X(o.notes ?? '')
  const oResp  = X(o.responsavel ?? '')

  /* ── Cliente ── */
  const cName  = X(cust.name  ?? '—')
  const cPhone = X(cust.phone ?? '')

  /* ── QR Code: aponta para /pedidos?open=<id> ── */
  const orderId  = String(o.id ?? '')
  const origin   = typeof window !== 'undefined' ? window.location.origin : ''
  const qrTarget = orderId ? `${origin}/pedidos?open=${orderId}` : ''
  let qrDataUrl = ''
  if (qrTarget) {
    try { qrDataUrl = await QRCode.toDataURL(qrTarget, { margin: 1, width: 180, color: { dark: '#1a1208', light: '#ffffff' } }) }
    catch { qrDataUrl = '' }
  }

  /* ── Logo ── */
  const logoHTML = logoUrl
    ? `<img src="${logoUrl}" alt="${coName}" style="max-height:56px;max-width:150px;object-fit:contain;display:block;">`
    : `<div style="width:50px;height:50px;background:${primary};border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;">${String(co.name??'P').charAt(0).toUpperCase()}</div>`

  /* ── Itens — mesma fonte única do PDF do cliente, sem preços ── */
  const effectiveItems = getOrderItems(order, items)

  const fmtDim = (item: typeof effectiveItems[0]) => {
    const w = Number(item.width)
    const h = Number(item.height)
    const u = item.measurement_unit ?? 'm'
    if (!w || !h) return ''
    return formatDimDisplay(w, h, u)
  }

  const specRow = (label: string, value: string) => value
    ? `<div class="spec"><span class="spec-l">${label}:</span><span class="spec-v">${value}</span></div>`
    : ''

  const itemsHTML = effectiveItems.length === 0
    ? `<div class="item-card"><div class="item-empty">Nenhum item cadastrado</div></div>`
    : effectiveItems.map((item, idx) => {
        const dim  = fmtDim(item)
        const fins = (item.finishings ?? []).filter(Boolean)
        const finT = item.finishing_type ?? ''
        const desc = item.description ?? ''
        const obs  = item.technical_notes ?? ''
        return `
        <div class="item-card">
          <div class="item-hdr">
            <span class="item-idx">${idx + 1}</span>
            <span class="item-name">${X(item.name)}</span>
          </div>
          <div class="item-specs">
            ${specRow('Quantidade', `${Number(item.quantity) || 1} unidades`)}
            ${specRow('Descrição', X(desc))}
            ${specRow('Medidas', X(dim))}
            ${specRow('Acabamento', fins.map(X).join(' · '))}
            ${specRow('Finalização', X(finT))}
            ${specRow('Observações técnicas', X(obs))}
          </div>
        </div>`
      }).join('')

  /* ── Arte do cliente ──────────────────────────────────────────────────────
     A arte NUNCA pode ser cortada. Imagens são exibidas inteiras, com a
     proporção original preservada (sem object-fit:cover, sem caixa quadrada
     fixa): a <img> só recebe limites de largura/altura (max-width/max-height)
     e o navegador reduz proporcionalmente o que passar disso. Espaço branco
     ao redor é aceitável. Uma única imagem ganha destaque (altura maior);
     várias empilham verticalmente, cada uma inteira, com quebra de página
     limpa quando não couberem todas em uma folha A4. Arquivos não-imagem
     (PDF/AI/EPS/CDR/ZIP) continuam como cartão de ícone + link. */
  const files = (artFiles ?? []).filter(f => f?.file_url)
  const imgFiles = files.filter(f => getFileKind(f.file_name).isImage)
  const docFiles = files.filter(f => !getFileKind(f.file_name).isImage)
  const singleArt = imgFiles.length === 1 && docFiles.length === 0

  const imgFigHTML = (f: OrderFile, big: boolean) => {
    const dl = getDownloadUrl(f.file_url, f.file_name)
    return `
      <figure class="art-fig${big ? ' art-fig--single' : ''}">
        <a href="${f.file_url}" target="_blank" class="art-view" title="Abrir arte em tamanho original">
          <img src="${f.file_url}" alt="${X(f.file_name)}" loading="eager">
        </a>
        <figcaption class="art-cap">
          <span class="art-fname">${X(f.file_name)}</span>
          <a href="${dl}" target="_blank" class="art-dl">Baixar arte original</a>
        </figcaption>
      </figure>`
  }

  const docFigHTML = (f: OrderFile) => {
    const kind = getFileKind(f.file_name)
    const dl   = getDownloadUrl(f.file_url, f.file_name)
    return `
      <figure class="art-fig art-fig--doc">
        <div class="art-doc-icon">${kind.label}</div>
        <figcaption class="art-cap">
          <span class="art-fname">${X(f.file_name)}</span>
          <a href="${dl}" target="_blank" class="art-dl">Baixar arquivo original</a>
        </figcaption>
      </figure>`
  }

  const artInnerHTML = singleArt
    ? imgFigHTML(imgFiles[0], true)
    : `<div class="art-stack">${imgFiles.map(f => imgFigHTML(f, false)).join('')}${docFiles.map(docFigHTML).join('')}</div>`

  const artBlockHTML = files.length > 0 ? `
  <div class="slbl">Arte do Cliente</div>
  <div class="art-w">${artInnerHTML}</div>` : ''

  const checklistHTML = CHECKLIST.map(label => `
    <div class="chk-item"><span class="chk-box"></span><span class="chk-label">${label}</span></div>
  `).join('')

  /* ── HTML ── */
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Ficha de Produção ${oNum} — ${coName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  @page{size:A4 portrait;margin:10mm;}
  @media print{
    html,body{background:#fff;}
    .no-print{display:none!important;}
    .page{margin:0!important;box-shadow:none!important;width:100%!important;overflow:visible!important;}
    /* identificação em toda página impressa (útil quando a arte gera folhas extras) */
    .print-tag{display:block;position:fixed;bottom:4mm;right:8mm;
      font-size:8px;letter-spacing:.5px;color:#aaa;}
  }
  .print-tag{display:none;}
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
    margin:20px auto;box-shadow:0 4px 40px rgba(0,0,0,.18);overflow:visible;
  }
  .stripe{height:4px;background:${primary};}
  .hdr{display:table;width:100%;padding:15px 26px 12px;
    border-bottom:1px solid #ede9e3;}
  .hdr-l{display:table-cell;vertical-align:middle;width:52%;}
  .hdr-r{display:table-cell;vertical-align:top;text-align:right;}
  .co-row{display:table;}
  .co-logo{display:table-cell;vertical-align:middle;padding-right:14px;}
  .co-info{display:table-cell;vertical-align:middle;}
  .co-name{font-size:16px;font-weight:700;color:#1a1208;letter-spacing:-.3px;}
  .co-tag{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#999;margin-top:2px;}
  .bcard{
    display:inline-block;border:2px solid #1a1208;
    border-radius:8px;padding:12px 16px 10px;min-width:170px;
  }
  .bc-type{font-size:8px;font-weight:700;letter-spacing:3px;
    text-transform:uppercase;color:#999;display:block;margin-bottom:2px;}
  .bc-num{font-size:19px;font-weight:700;color:#1a1208;
    font-family:'Courier New',monospace;display:block;
    letter-spacing:-.5px;margin-bottom:8px;}
  .bc-row{font-size:10px;color:#888;margin-top:2.5px;}
  .bc-row b{color:#1a1208;font-weight:600;}
  .slbl{
    font-size:8px;font-weight:700;letter-spacing:3px;
    text-transform:uppercase;color:#bbb;
    padding:9px 26px 4px;
    display:flex;align-items:center;gap:8px;
  }
  .slbl::after{content:'';flex:1;height:1px;background:#ede9e3;}
  .cl{padding:0 26px 10px;}
  .cl-grid{display:table;width:100%;
    border:1px solid #ede9e3;border-radius:8px;
    overflow:hidden;border-collapse:separate;}
  .cl-cell{display:table-cell;padding:12px 14px;
    border-right:1px solid #ede9e3;vertical-align:top;width:25%;
    background:#fff;}
  .cl-cell:last-child{border-right:none;}
  .lbl{font-size:8px;font-weight:700;letter-spacing:2px;
    text-transform:uppercase;color:#ccc;display:block;margin-bottom:3px;}
  .val{font-size:12.5px;font-weight:500;color:#1a1208;line-height:1.4;}
  .items-w{padding:0 26px 4px;}
  .item-card{border:1px solid #ede9e3;border-radius:8px;margin-bottom:10px;overflow:hidden;page-break-inside:avoid;}
  .item-hdr{background:${primary};padding:8px 14px;display:flex;align-items:center;gap:8px;}
  .item-idx{width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.2);
    color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .item-name{color:#fff;font-size:13px;font-weight:700;}
  .item-specs{padding:10px 14px;background:#faf8f5;}
  .item-empty{padding:20px;text-align:center;color:#bbb;font-size:12px;font-style:italic;}
  .spec{display:table;width:100%;padding:4px 0;}
  .spec-l{display:table-cell;width:150px;font-size:10px;font-weight:700;
    letter-spacing:.5px;text-transform:uppercase;color:#9a8a7a;vertical-align:top;}
  .spec-v{display:table-cell;font-size:12.5px;color:#333;line-height:1.5;}
  .obs-w{padding:0 26px 14px;}
  .obs-box{background:#fffdf7;border:1px solid #e0d8c0;
    border-left:3px solid #c8b060;
    border-radius:0 6px 6px 0;padding:12px 16px;}
  .obs-txt{font-size:11.5px;color:#666;line-height:1.8;}
  /* ── Arte do cliente — imagem inteira, proporção preservada, nunca cortada ── */
  .art-w{padding:2px 26px 14px;}
  .art-stack{display:flex;flex-direction:column;gap:12px;}
  .art-fig{margin:0;border:1px solid #ede9e3;border-radius:8px;background:#faf8f5;
    padding:10px;page-break-inside:avoid;break-inside:avoid;}
  .art-view{display:block;border-radius:4px;overflow:hidden;text-align:center;
    /* xadrez discreto: dá contexto ao PNG com transparência sem alterar a arte */
    background-color:#fff;
    background-image:
      linear-gradient(45deg,#eee 25%,transparent 25%,transparent 75%,#eee 75%),
      linear-gradient(45deg,#eee 25%,transparent 25%,transparent 75%,#eee 75%);
    background-size:18px 18px;background-position:0 0,9px 9px;}
  .art-fig img{display:block;margin:0 auto;
    max-width:100%;max-height:60mm;width:auto;height:auto;
    object-fit:contain;}
  .art-fig--single img{max-height:118mm;}
  @media print{
    /* na impressão a arte cede um pouco de altura para caber com o resto
       na mesma folha A4; ainda assim inteira e com proporção preservada.
       Ordem importa: a regra de --single vem depois p/ vencer no empate. */
    .art-fig img{max-height:44mm;}
    .art-fig--single img{max-height:62mm;}
  }
  .art-fig--doc{display:block;}
  .art-doc-icon{display:flex;align-items:center;justify-content:center;
    height:70px;font-size:12px;font-weight:700;letter-spacing:1px;
    color:${primary};text-transform:uppercase;background:#fff;border-radius:4px;}
  .art-cap{display:flex;align-items:center;justify-content:space-between;
    gap:12px;margin-top:7px;}
  .art-fname{font-size:10px;color:#888;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .art-dl{font-size:10px;color:${primary};font-weight:700;
    text-decoration:none;white-space:nowrap;flex-shrink:0;}
  .chk-w{padding:0 26px 14px;page-break-inside:avoid;break-inside:avoid;}
  .chk-grid{display:flex;flex-wrap:wrap;gap:10px 22px;
    border:1px solid #ede9e3;border-radius:8px;padding:14px 16px;}
  .chk-item{display:flex;align-items:center;gap:8px;width:calc(50% - 11px);}
  .chk-box{width:15px;height:15px;border:1.5px solid #1a1208;border-radius:3px;flex-shrink:0;}
  .chk-label{font-size:12px;color:#333;}
  .bot2{display:table;width:100%;padding:6px 26px 4px;page-break-inside:avoid;break-inside:avoid;}
  .bot2-l{display:table-cell;vertical-align:top;width:55%;padding-right:18px;}
  .bot2-r{display:table-cell;vertical-align:top;text-align:center;}
  .sig-w{padding-top:18px;}
  .sig-line{border-top:1.5px solid #1a1208;width:220px;margin:0 auto;}
  .sig-label{font-size:10px;color:#999;margin-top:6px;text-align:center;}
  .sig-name{font-size:12px;color:#1a1208;font-weight:600;text-align:center;margin-top:2px;}
  .qr-box{display:inline-block;text-align:center;}
  .qr-box img{width:96px;height:96px;border:1px solid #ede9e3;border-radius:6px;padding:6px;}
  .qr-cap{font-size:9px;color:#999;margin-top:4px;letter-spacing:.5px;}
  .int-w{padding:8px 26px 4px;}
  .int-line{border-bottom:1px solid #ddd;height:22px;}
  .footer{border-top:1px solid #ede9e3;padding:10px 26px;
    display:table;width:100%;background:#faf8f5;margin-top:8px;}
  .fl2{display:table-cell;font-size:9.5px;color:#bbb;vertical-align:middle;}
  .fr2{display:table-cell;text-align:right;font-size:9.5px;color:#bbb;vertical-align:middle;}
  .fr2 b{color:#999;}
</style>
</head>
<body>

<div class="toolbar no-print">
  <button class="btn btn-p" onclick="window.print()">🖨 Baixar / Imprimir Ficha</button>
  <button class="btn btn-c" onclick="window.close()">Fechar</button>
  <span class="tb-title">Ficha de Produção · Pedido ${oNum} · ${coName}</span>
</div>

<div class="print-tag">${oNum} · Ficha de Produção${cName && cName !== '—' ? ` · ${cName}` : ''}</div>

<div class="page">
<div class="stripe"></div>

<div class="hdr">
  <div class="hdr-l">
    <div class="co-row">
      <div class="co-logo">${logoHTML}</div>
      <div class="co-info">
        <div class="co-name">${coName}</div>
        <div class="co-tag">Ficha de Produção</div>
      </div>
    </div>
  </div>
  <div class="hdr-r">
    <div class="bcard">
      <span class="bc-type">Pedido</span>
      <span class="bc-num">${oNum}</span>
      ${oDate ? `<div class="bc-row">Emissão: <b>${oDate}</b></div>` : ''}
      ${oDue  ? `<div class="bc-row">Prazo: <b>${oDue}</b></div>`    : ''}
      <div class="bc-row">Responsável: <b>${oResp || '—'}</b></div>
    </div>
  </div>
</div>

<div class="slbl">Dados do Pedido</div>
<div class="cl">
  <div class="cl-grid">
    <div class="cl-cell">
      <span class="lbl">Cliente</span>
      <div class="val">${cName}</div>
    </div>
    <div class="cl-cell">
      <span class="lbl">Telefone / WhatsApp</span>
      <div class="val">${cPhone || '—'}</div>
    </div>
    <div class="cl-cell">
      <span class="lbl">Data</span>
      <div class="val">${oDate || '—'}</div>
    </div>
    <div class="cl-cell">
      <span class="lbl">Prazo</span>
      <div class="val">${oDue || '—'}</div>
    </div>
  </div>
</div>

<div class="slbl">Produtos</div>
<div class="items-w">${itemsHTML}</div>

${artBlockHTML}

${oNotes ? `
<div class="slbl">Observações</div>
<div class="obs-w">
  <div class="obs-box">
    <div class="obs-txt">${oNotes}</div>
  </div>
</div>` : ''}

<div class="slbl">Checklist de Produção</div>
<div class="chk-w">
  <div class="chk-grid">${checklistHTML}</div>
</div>

<div class="bot2">
  <div class="bot2-l">
    <div class="slbl" style="padding-left:0;">Responsável</div>
    <div class="sig-w">
      <div class="sig-line"></div>
      <div class="sig-label">Assinatura</div>
      ${oResp ? `<div class="sig-name">${oResp}</div>` : ''}
    </div>
  </div>
  <div class="bot2-r">
    ${qrDataUrl ? `
    <div class="qr-box">
      <img src="${qrDataUrl}" alt="QR Code do pedido ${oNum}">
      <div class="qr-cap">Escaneie para abrir<br>o pedido ${oNum} no Precy+</div>
    </div>` : ''}
  </div>
</div>

<div class="slbl">Observações Internas</div>
<div class="int-w">
  <div class="int-line"></div>
  <div class="int-line"></div>
</div>

<div class="footer">
  <div class="fl2">${coName} · Ficha de Produção — uso interno</div>
  <div class="fr2">Gerado em ${new Date().toLocaleDateString('pt-BR')} &nbsp;·&nbsp; <b>Precy+</b></div>
</div>

</div><!-- .page -->
</body>
</html>`

  const win = window.open('', '_blank', 'width=980,height=760')
  if (win) { win.document.write(html); win.document.close(); win.focus() }
}
