/* =============================================================
   PRECY+ — Gerador de Relatórios PDF v2
   Layout A4 profissional, compatível com todos os browsers
   ============================================================= */

import { formatCurrency } from '@/lib/utils/format'

const R  = (v: unknown) => formatCurrency(Number(v)||0)
const N  = (v: unknown) => Number(v||0).toLocaleString('pt-BR')
const X  = (s: unknown) => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')
const D  = (s: string) => s.split('-').reverse().join('/')

type TabId = 'financeiro'|'pedidos'|'clientes'|'produtos'|'estoque'|'orcamentos'
const TAB_TITLE: Record<TabId,string> = {
  financeiro:'Relatório Financeiro', pedidos:'Relatório de Pedidos',
  clientes:'Relatório de Clientes', produtos:'Relatório de Produtos',
  estoque:'Relatório de Estoque', orcamentos:'Relatório de Orçamentos',
}
const PERIOD_LABEL: Record<string,string> = {
  month:'Este mês', last_month:'Mês anterior', quarter:'Trimestre', year:'Este ano', all:'Todo período',
}

interface ReportData {
  tab: TabId; period: string; start: string; end: string
  company?: Record<string,unknown>|null
  finTx?: any[]; orders?: any[]; customers?: any[]
  products?: any[]; inventory?: any[]; budgets?: any[]
  mode?: 'pdf' | 'print'
}

/* ── Componentes HTML ── */
function kpiGrid(items: {label:string;value:string;sub?:string;color?:string}[]) {
  return `<div style="display:grid;grid-template-columns:repeat(${Math.min(items.length,4)},1fr);gap:12px;margin-bottom:20px;">
    ${items.map(k=>`
      <div style="border:1px solid #e8e5e0;border-radius:10px;padding:14px 16px;background:#fff;">
        <p style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#bbb;margin:0 0 4px;">${X(k.label)}</p>
        <p style="font-size:20px;font-weight:700;color:${k.color||'#1a1208'};margin:0 0 2px;">${k.value}</p>
        ${k.sub?`<p style="font-size:10px;color:#aaa;margin:0;">${X(k.sub)}</p>`:''}
      </div>`).join('')}
  </div>`
}

function sectionHeader(title: string) {
  return `<div style="display:flex;align-items:center;gap:10px;margin:22px 0 10px;">
    <span style="font-size:12px;font-weight:700;color:#1a1208;">${X(title)}</span>
    <div style="flex:1;height:1px;background:#e8e5e0;"></div>
  </div>`
}

function barChart(rows:{label:string;value:number;color:string}[], fmt:(v:number)=>string=R) {
  if(!rows.length) return '<p style="color:#bbb;font-size:11px;font-style:italic;padding:8px 0;">Sem dados no período.</p>'
  const max = Math.max(...rows.map(r=>r.value), 1)
  return `<div style="margin-bottom:16px;">${rows.map(r=>`
    <div style="display:table;width:100%;margin-bottom:7px;">
      <div style="display:table-cell;width:130px;font-size:10.5px;color:#666;text-align:right;padding-right:10px;vertical-align:middle;">${X(r.label)}</div>
      <div style="display:table-cell;vertical-align:middle;">
        <div style="height:14px;border-radius:4px;background:${r.color};width:${Math.max(2,(r.value/max)*65)}%;min-width:3px;display:inline-block;"></div>
        <span style="font-size:10.5px;font-weight:600;margin-left:8px;color:#333;">${fmt(r.value)}</span>
      </div>
    </div>`).join('')}</div>`
}

function dataTable(headers: string[], rows: string[][], accent='#8B6C4F') {
  if(!rows.length) return '<p style="text-align:center;color:#bbb;font-style:italic;padding:16px 0;font-size:11px;">Sem registros no período.</p>'
  const ths = headers.map(h=>`<th style="padding:7px 10px;text-align:left;font-size:8.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.9);white-space:nowrap;">${X(h)}</th>`).join('')
  const trs = rows.map((row,i)=>{
    const bg = i%2===0?'#fff':'#faf8f5'
    const tds = row.map(c=>`<td style="padding:7px 10px;font-size:11px;color:#333;border-bottom:1px solid #ede9e3;">${c}</td>`).join('')
    return `<tr style="background:${bg};">${tds}</tr>`
  }).join('')
  return `<table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #ddd;">
    <thead><tr style="background:${accent};">${ths}</tr></thead>
    <tbody>${trs}</tbody>
  </table>`
}

function badge(text:string, bg='#f0ece6', color='#666') {
  return `<span style="background:${bg};color:${color};padding:2px 8px;border-radius:20px;font-size:9.5px;font-weight:700;">${X(text)}</span>`
}

/* ── Corpo por aba ── */
function buildBody(data: ReportData): string {
  const { tab, finTx=[], orders=[], customers=[], products=[], inventory=[], budgets=[] } = data

  /* ──── FINANCEIRO ──── */
  if(tab==='financeiro') {
    const real    = finTx.filter(t=>t.status==='received'||t.status==='paid')
    const fore    = finTx.filter(t=>['pending','to_pay','partial'].includes(t.status??''))
    const inc     = real.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0)
    const exp     = real.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0)
    const bal     = inc-exp
    const pend    = fore.reduce((s,t)=>s+Number(t.amount),0)
    const cnt     = real.filter(t=>t.type==='income').length
    const ticket  = cnt>0?inc/cnt:0
    const margin  = inc>0?((bal/inc)*100).toFixed(1)+'%':'—'

    // Por mês
    const mm: Record<string,{inc:number;exp:number}> = {}
    real.forEach(t=>{ const k=(t.date??'').slice(0,7); if(!mm[k]) mm[k]={inc:0,exp:0}; if(t.type==='income') mm[k].inc+=Number(t.amount); else mm[k].exp+=Number(t.amount) })

    // Categorias
    const cats: Record<string,number> = {}
    real.filter(t=>t.type==='expense').forEach(t=>{ cats[t.category]=(cats[t.category]||0)+Number(t.amount) })
    const catRows = Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,8)

    // Tabela últimas transações
    const txRows = [...real].sort((a,b)=>(b.date??'').localeCompare(a.date??'')).slice(0,25).map(t=>[
      X(t.date?.slice(0,10)??''),
      X(t.description||(t.type==='income'?'Receita':'Despesa')),
      X(t.category??''),
      `<span style="color:${t.type==='income'?'#166534':'#b91c1c'};font-weight:600;">${t.type==='income'?'+':'-'}${R(t.amount)}</span>`,
      badge(t.type==='income'?(t.status==='received'?'Recebido':'Pendente'):(t.status==='paid'?'Pago':'A pagar'),
        t.type==='income'&&t.status==='received'?'#dcfce7':t.status==='paid'?'#dcfce7':'#fef9c3',
        t.type==='income'&&t.status==='received'?'#166534':t.status==='paid'?'#166534':'#a16207'),
    ])

    return `
      ${kpiGrid([
        {label:'Receitas realizadas',value:R(inc),sub:`${cnt} lançamentos`,color:'#166534'},
        {label:'Despesas realizadas',value:R(exp),color:'#b91c1c'},
        {label:'Saldo do período',value:R(bal),sub:`Margem: ${margin}`,color:bal>=0?'#8B6C4F':'#b91c1c'},
        {label:'Pendentes/Previstos',value:R(pend),sub:'a liquidar',color:'#a16207'},
      ])}
      ${kpiGrid([
        {label:'Ticket médio',value:R(ticket),color:'#8B6C4F'},
        {label:'Qtd receitas',value:N(cnt),color:'#8B6C4F'},
        {label:'Qtd despesas',value:N(real.filter(t=>t.type==='expense').length),color:'#8B6C4F'},
        {label:'Total lançamentos',value:N(finTx.length),color:'#8B6C4F'},
      ])}
      ${sectionHeader('Receitas vs Despesas por período')}
      ${barChart(
        Object.entries(mm).sort().flatMap(([k])=>[
          {label:`${k.slice(5)}/${k.slice(2,4)} Rec`,value:mm[k].inc,color:'#5C8B4F'},
          {label:`${k.slice(5)}/${k.slice(2,4)} Desp`,value:mm[k].exp,color:'#EF4444'},
        ])
      )}
      ${sectionHeader('Despesas por categoria')}
      ${barChart(catRows.map(([l,v])=>({label:X(l),value:v,color:'#8B6C4F'})))}
      ${sectionHeader(`Transações (${txRows.length} registros)`)}
      ${dataTable(['Data','Descrição','Categoria','Valor','Status'],txRows)}`
  }

  /* ──── PEDIDOS ──── */
  if(tab==='pedidos') {
    const total = orders.reduce((s,o)=>s+Number(o.total),0)
    const ticket = orders.length>0?total/orders.length:0
    const STATUS: Record<string,string> = {pending:'Pendente',production:'Em produção',ready:'Pronto',delivered:'Entregue'}
    const bySt: Record<string,{count:number;val:number}> = {}
    orders.forEach(o=>{ if(!bySt[o.status]) bySt[o.status]={count:0,val:0}; bySt[o.status].count++; bySt[o.status].val+=Number(o.total) })
    const STCOLOR: Record<string,string> = {pending:'#F59E0B',production:'#3B82F6',ready:'#10B981',delivered:'#8B6C4F'}
    const orderRows = [...orders].sort((a,b)=>(b.created_at??'').localeCompare(a.created_at??'')).slice(0,30).map(o=>[
      X(o.order_number??'—'),
      X((o.customers as any)?.name??'—'),
      X(o.service_name??'—'),
      badge(STATUS[o.status]??o.status, STCOLOR[o.status]+'22', STCOLOR[o.status]),
      `<strong>${R(o.total)}</strong>`,
      X(o.due_date?.slice(0,10)??'—'),
    ])
    return `
      ${kpiGrid([
        {label:'Total pedidos',value:N(orders.length),color:'#8B6C4F'},
        {label:'Valor total',value:R(total),color:'#166534'},
        {label:'Ticket médio',value:R(ticket),color:'#8B6C4F'},
        {label:'Entregues',value:N(orders.filter(o=>o.status==='delivered').length),color:'#166534'},
      ])}
      ${sectionHeader('Pedidos por status')}
      ${barChart(Object.entries(bySt).map(([s,{count}])=>({label:STATUS[s]??s,value:count,color:STCOLOR[s]??'#8B6C4F'})),N)}
      ${sectionHeader('Valor por status')}
      ${barChart(Object.entries(bySt).map(([s,{val}])=>({label:STATUS[s]??s,value:val,color:STCOLOR[s]??'#8B6C4F'})))}
      ${sectionHeader(`Lista de pedidos (${orderRows.length} registros)`)}
      ${dataTable(['Nº Pedido','Cliente','Serviço','Status','Valor','Entrega'],orderRows)}`
  }

  /* ──── CLIENTES ──── */
  if(tab==='clientes') {
    const byClient: Record<string,{count:number;total:number}> = {}
    orders.forEach(o=>{ const n=(o.customers as any)?.name??'Sem cliente'; if(!byClient[n]) byClient[n]={count:0,total:0}; byClient[n].count++; byClient[n].total+=Number(o.total) })
    const top = Object.entries(byClient).sort((a,b)=>b[1].total-a[1].total).slice(0,15)
    const cRows = top.map(([name,{count,total}])=>[
      X(name), N(count), `<strong>${R(total)}</strong>`, R(count>0?total/count:0),
    ])
    return `
      ${kpiGrid([
        {label:'Total clientes',value:N(customers.length),color:'#8B6C4F'},
        {label:'Com pedidos',value:N(top.length),sub:'no período',color:'#8B6C4F'},
        {label:'Receita total',value:R(orders.reduce((s,o)=>s+Number(o.total),0)),color:'#166534'},
        {label:'Ticket médio',value:R(top.length>0?orders.reduce((s,o)=>s+Number(o.total),0)/orders.length:0),color:'#8B6C4F'},
      ])}
      ${sectionHeader('Top clientes por valor')}
      ${barChart(top.slice(0,10).map(([name,{total}])=>({label:name.slice(0,20),value:total,color:'#8B6C4F'})))}
      ${sectionHeader(`Ranking de clientes (${cRows.length} clientes)`)}
      ${dataTable(['Cliente','Pedidos','Total gasto','Ticket médio'],cRows)}`
  }

  /* ──── PRODUTOS ──── */
  if(tab==='produtos') {
    const active = products.filter(p=>p.is_active!==false)
    const wm = active.filter(p=>Number(p.final_price)>0).map(p=>({
      name:String(p.name),price:Number(p.final_price),cost:Number(p.total_cost),
      margin:Number(p.total_cost)>0?((Number(p.final_price)-Number(p.total_cost))/Number(p.final_price)*100):0,
    })).sort((a,b)=>b.margin-a.margin)
    const avgM = wm.length>0?wm.reduce((s,p)=>s+p.margin,0)/wm.length:0
    const pRows = wm.slice(0,25).map(p=>[
      X(p.name),R(p.price),R(p.cost),
      `<span style="color:${p.margin>=40?'#166534':p.margin>=20?'#8B6C4F':'#b91c1c'};font-weight:700;">${p.margin.toFixed(1)}%</span>`,
      badge(p.margin>=40?'Alta margem':p.margin>=20?'Boa margem':'Baixa margem',
        p.margin>=40?'#dcfce7':p.margin>=20?'#fef9c3':'#fee2e2',
        p.margin>=40?'#166534':p.margin>=20?'#a16207':'#b91c1c'),
    ])
    return `
      ${kpiGrid([
        {label:'Produtos ativos',value:N(active.length),color:'#8B6C4F'},
        {label:'Margem média',value:avgM.toFixed(1)+'%',color:avgM>=30?'#166534':'#b91c1c'},
        {label:'Ticket médio',value:active.length>0?R(active.reduce((s,p)=>s+Number(p.final_price),0)/active.length):R(0),color:'#8B6C4F'},
        {label:'Com alta margem',value:N(wm.filter(p=>p.margin>=40).length),sub:'≥ 40%',color:'#166534'},
      ])}
      ${sectionHeader('Margem de lucro por produto (%)')}
      ${barChart(wm.slice(0,12).map(p=>({label:p.name.slice(0,20),value:p.margin,color:p.margin>=40?'#5C8B4F':p.margin>=20?'#8B6C4F':'#EF4444'})),v=>`${v.toFixed(1)}%`)}
      ${sectionHeader(`Tabela de produtos (${pRows.length} registros)`)}
      ${dataTable(['Produto','Preço venda','Custo total','Margem','Classificação'],pRows)}`
  }

  /* ──── ESTOQUE ──── */
  if(tab==='estoque') {
    const crit = inventory.filter(i=>i.status==='critical')
    const warn = inventory.filter(i=>i.status==='warning')
    const ok   = inventory.filter(i=>i.status==='healthy')
    const cost = inventory.reduce((s,i)=>s+Number(i.cost_per_unit)*Number(i.quantity),0)
    const invRows = [...inventory].sort((a,b)=>(a.name??'').localeCompare(b.name??'')).slice(0,30).map(i=>[
      X(i.name),X(i.category??'—'),
      `<span style="color:${i.status==='critical'?'#b91c1c':i.status==='warning'?'#a16207':'#166534'};font-weight:600;">${N(i.quantity)} ${X(i.unit??'')}</span>`,
      `${N(i.minimum_quantity)} ${X(i.unit??'')}`,R(i.cost_per_unit),
      badge(i.status==='critical'?'Crítico':i.status==='warning'?'Atenção':'Saudável',
        i.status==='critical'?'#fee2e2':i.status==='warning'?'#fef9c3':'#dcfce7',
        i.status==='critical'?'#b91c1c':i.status==='warning'?'#a16207':'#166534'),
    ])
    return `
      ${kpiGrid([
        {label:'Total de itens',value:N(inventory.length),color:'#8B6C4F'},
        {label:'Críticos',value:N(crit.length),sub:'abaixo do mínimo',color:'#b91c1c'},
        {label:'Em atenção',value:N(warn.length),color:'#a16207'},
        {label:'Saudáveis',value:N(ok.length),color:'#166534'},
      ])}
      ${kpiGrid([{label:'Valor total em estoque',value:R(cost),color:'#8B6C4F'}])}
      ${crit.length+warn.length>0?`
        ${sectionHeader('⚠️ Itens que precisam de atenção')}
        ${dataTable(['Material','Qtd atual','Qtd mínima','Status'],
          [...crit,...warn].map(i=>[X(i.name),`${N(i.quantity)} ${X(i.unit??'')}`,`${N(i.minimum_quantity)} ${X(i.unit??'')}`,
            badge(i.status==='critical'?'Crítico':'Atenção',i.status==='critical'?'#fee2e2':'#fef9c3',i.status==='critical'?'#b91c1c':'#a16207')
          ])
        )}`:''}
      ${sectionHeader(`Inventário completo (${invRows.length} itens)`)}
      ${dataTable(['Material','Categoria','Quantidade','Mínimo','Custo/un','Status'],invRows)}`
  }

  /* ──── ORÇAMENTOS ──── */
  if(tab==='orcamentos') {
    const appr  = budgets.filter(b=>b.status==='approved'||b.status==='converted')
    const conv  = budgets.length>0?(appr.length/budgets.length*100).toFixed(1)+'%':'0%'
    const total = budgets.reduce((s,b)=>s+Number(b.total),0)
    const avgVal= budgets.length>0?total/budgets.length:0
    const SL: Record<string,string> = {draft:'Rascunho',sent:'Enviado',approved:'Aprovado',rejected:'Recusado',converted:'Convertido'}
    const SC: Record<string,string> = {draft:'#9CA3AF',sent:'#3B82F6',approved:'#10B981',rejected:'#EF4444',converted:'#8B6C4F'}
    const bySt: Record<string,{count:number;val:number}> = {}
    budgets.forEach(b=>{ if(!bySt[b.status]) bySt[b.status]={count:0,val:0}; bySt[b.status].count++; bySt[b.status].val+=Number(b.total) })
    const bRows = [...budgets].sort((a,b)=>(b.created_at??'').localeCompare(a.created_at??'')).slice(0,25).map(b=>[
      X((b.customers as any)?.name??'—'),
      badge(SL[b.status]??b.status,SC[b.status]+'22',SC[b.status]),
      `<strong>${R(b.total)}</strong>`,
      X(b.created_at?.slice(0,10)??'—'),
    ])
    return `
      ${kpiGrid([
        {label:'Total orçamentos',value:N(budgets.length),color:'#8B6C4F'},
        {label:'Aprovados',value:N(appr.length),color:'#166534'},
        {label:'Taxa de conversão',value:conv,color:'#8B6C4F'},
        {label:'Valor total',value:R(total),color:'#166534'},
      ])}
      ${kpiGrid([{label:'Ticket médio',value:R(avgVal),color:'#8B6C4F'},{label:'Valor médio aprovado',value:R(appr.length>0?appr.reduce((s,b)=>s+Number(b.total),0)/appr.length:0),color:'#166534'}])}
      ${sectionHeader('Orçamentos por status')}
      ${barChart(Object.entries(bySt).map(([s,{count}])=>({label:SL[s]??s,value:count,color:SC[s]??'#8B6C4F'})),N)}
      ${sectionHeader(`Lista de orçamentos (${bRows.length} registros)`)}
      ${dataTable(['Cliente','Status','Valor','Data emissão'],bRows)}`
  }

  return '<p style="color:#aaa;text-align:center;padding:40px 0;">Selecione uma aba para exportar.</p>'
}

/* ════════════════════════════════════════════════
   FUNÇÃO PRINCIPAL
════════════════════════════════════════════════ */
export function generateReportPDF(data: ReportData) {
  const co      = data.company as any ?? {}
  const primary = String(co.primary_color ?? '#8B6C4F')
  const coName  = String(co.name ?? 'Precy+')
  const logoUrl = co.logo_url as string|undefined
  const title   = TAB_TITLE[data.tab]
  const period  = PERIOD_LABEL[data.period] ?? data.period
  const now     = new Date()

  const logoHTML = logoUrl
    ? `<img src="${logoUrl}" alt="${coName}" style="max-height:52px;max-width:150px;object-fit:contain;display:block;">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:${primary};display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:700;">${coName.charAt(0).toUpperCase()}</div>`

  const css = `
    *{margin:0;padding:0;box-sizing:border-box;}
    @page{size:A4 portrait;margin:12mm 12mm 14mm 12mm;}
    @media print{
      html,body{background:#fff;}
      .no-print{display:none!important;}
      .page{margin:0!important;box-shadow:none!important;width:100%!important;}
      tr,div{page-break-inside:avoid;}
      .page-break{page-break-before:always;}
    }
    html,body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#ddd;
      color:#1a1208;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .toolbar{background:#1a1208;padding:10px 20px;position:sticky;top:0;z-index:99;
      display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
    .btn{padding:7px 16px;border:none;border-radius:6px;font-size:12px;
      font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;}
    .btn-print{background:#fff;color:#1a1208;}
    .btn-pdf{background:${primary};color:#fff;}
    .btn-close{background:transparent;color:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.2)!important;}
    .tb-info{color:rgba(255,255,255,.5);font-size:11px;margin-left:auto;}
    .page{background:#fff;width:210mm;min-height:297mm;margin:16px auto;
      box-shadow:0 4px 40px rgba(0,0,0,.2);overflow:hidden;}
    .stripe{height:4px;background:${primary};}
    .hdr{display:table;width:100%;padding:18px 24px 14px;border-bottom:1px solid #ede9e3;}
    .hdr-l{display:table-cell;vertical-align:middle;width:55%;}
    .hdr-r{display:table-cell;vertical-align:top;text-align:right;}
    .co-row{display:table;}
    .co-logo{display:table-cell;vertical-align:middle;padding-right:12px;}
    .co-info{display:table-cell;vertical-align:middle;}
    .co-name{font-size:15px;font-weight:700;color:#1a1208;}
    .co-sub{font-size:10px;color:#999;margin-top:3px;line-height:1.6;}
    .rep-label{font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#bbb;display:block;margin-bottom:2px;}
    .rep-title{font-size:17px;font-weight:700;color:#1a1208;display:block;margin-bottom:4px;}
    .rep-meta{font-size:10.5px;color:#999;}
    .body{padding:18px 24px 20px;}
    .footer{border-top:1px solid #ede9e3;padding:10px 24px;display:table;width:100%;background:#faf8f5;}
    .fl{display:table-cell;font-size:9.5px;color:#bbb;}
    .fr{display:table-cell;text-align:right;font-size:9.5px;color:#bbb;}
  `

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>${title} — ${coName}</title><style>${css}</style></head>
<body>
<div class="toolbar no-print">
  <button class="btn btn-print" onclick="window.print()">🖨️ Imprimir</button>
  <button class="btn btn-pdf" onclick="window.print()">⬇ Baixar PDF</button>
  <button class="btn btn-close" onclick="window.close()">✕ Fechar</button>
  <span class="tb-info">${title} · ${coName} · ${period}</span>
</div>
<div class="page">
  <div class="stripe"></div>
  <div class="hdr">
    <div class="hdr-l">
      <div class="co-row">
        <div class="co-logo">${logoHTML}</div>
        <div class="co-info">
          <div class="co-name">${X(coName)}</div>
          <div class="co-sub">
            ${co.cnpj?`CNPJ: ${X(co.cnpj)}<br>`:''}
            ${co.phone?`${X(co.phone)}${co.email?' · ':''}`:''}
            ${co.email?`${X(co.email)}`:''}
          </div>
        </div>
      </div>
    </div>
    <div class="hdr-r">
      <span class="rep-label">Relatório</span>
      <span class="rep-title">${X(title.replace('Relatório ',''))}</span>
      <span class="rep-meta">
        ${X(period)}<br>
        ${D(data.start)} → ${D(data.end)}<br>
        Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
      </span>
    </div>
  </div>
  <div class="body">${buildBody(data)}</div>
  <div class="footer">
    <div class="fl">${X(coName)} · ${X(period)} · ${D(data.start)} → ${D(data.end)}</div>
    <div class="fr">Gerado pelo <strong>Precy+</strong></div>
  </div>
</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1000,height=800')
  if(win){ win.document.write(html); win.document.close(); win.focus() }
}
