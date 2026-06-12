/* ============================================================
   PRECY+ — PDF de Relatórios
   Template HTML premium, compatível com window.print()
   ============================================================ */

const R = (v: unknown) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)
const N = (v: unknown) => Number(v || 0).toLocaleString('pt-BR')
const P = (v: number, total: number) => total > 0 ? ((v / total) * 100).toFixed(1) + '%' : '0%'

function X(s: unknown) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

type TabId = 'financeiro'|'pedidos'|'clientes'|'produtos'|'estoque'|'orcamentos'

interface ReportData {
  tab:        TabId
  period:     string
  start:      string
  end:        string
  company?:   Record<string,unknown> | null
  finTx?:     any[]
  orders?:    any[]
  customers?: any[]
  products?:  any[]
  inventory?: any[]
  budgets?:   any[]
}

const TAB_LABELS: Record<TabId, string> = {
  financeiro: 'Relatório Financeiro', pedidos: 'Relatório de Pedidos',
  clientes: 'Relatório de Clientes', produtos: 'Relatório de Produtos',
  estoque: 'Relatório de Estoque', orcamentos: 'Relatório de Orçamentos',
}

const PERIOD_LABELS: Record<string, string> = {
  month: 'Este mês', last_month: 'Mês anterior', quarter: 'Trimestre',
  year: 'Este ano', all: 'Todo período',
}

/* ── Mini bar chart em HTML/CSS ── */
function barChart(rows: { label: string; value: number; color: string }[], maxVal?: number) {
  if (!rows.length) return '<p style="color:#aaa;font-size:12px;font-style:italic;">Sem dados</p>'
  const max = maxVal ?? Math.max(...rows.map(r => r.value), 1)
  return rows.map(r => `
    <div style="display:table;width:100%;margin-bottom:8px;">
      <div style="display:table-cell;width:100px;font-size:11px;color:#666;vertical-align:middle;padding-right:8px;text-align:right;">${X(r.label)}</div>
      <div style="display:table-cell;vertical-align:middle;">
        <div style="height:16px;border-radius:4px;background:${r.color};width:${Math.max(2,(r.value/max)*100)}%;min-width:2px;display:inline-block;"></div>
        <span style="font-size:11px;font-weight:600;margin-left:6px;color:#333;">${R(r.value)}</span>
      </div>
    </div>`).join('')
}

/* ── Tabela genérica ── */
function table(headers: string[], rows: string[][], accent = '#8B6C4F') {
  if (!rows.length) return '<p style="color:#aaa;font-size:12px;font-style:italic;text-align:center;padding:16px;">Sem dados no período</p>'
  const ths = headers.map(h => `<th style="padding:8px 12px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.85);white-space:nowrap;">${X(h)}</th>`).join('')
  const trs = rows.map((row, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#faf8f5'
    const tds = row.map(cell => `<td style="padding:8px 12px;font-size:12px;color:#333;border-bottom:1px solid #ede9e3;">${cell}</td>`).join('')
    return `<tr style="background:${bg};">${tds}</tr>`
  }).join('')
  return `
    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #ddd;">
      <thead><tr style="background:${accent};">${ths}</tr></thead>
      <tbody>${trs}</tbody>
    </table>`
}

/* ── KPI card ── */
function kpi(label: string, value: string, sub?: string, color = '#1a1208') {
  return `
    <div style="border:1px solid #e8e5e0;border-radius:10px;padding:14px 16px;background:#fff;">
      <p style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#bbb;margin:0 0 4px;">${X(label)}</p>
      <p style="font-size:20px;font-weight:700;color:${color};margin:0 0 2px;">${value}</p>
      ${sub ? `<p style="font-size:10px;color:#aaa;margin:0;">${X(sub)}</p>` : ''}
    </div>`
}

/* ── Section header ── */
function section(title: string) {
  return `
    <div style="display:flex;align-items:center;gap:10px;margin:24px 0 12px;">
      <span style="font-size:13px;font-weight:700;color:#1a1208;">${X(title)}</span>
      <div style="flex:1;height:1px;background:#ede9e3;"></div>
    </div>`
}

/* ══════════════════════════════════════════
   CORPO DO RELATÓRIO POR ABA
══════════════════════════════════════════ */
function buildBody(data: ReportData): string {
  const { tab, finTx = [], orders = [], customers = [], products = [], inventory = [], budgets = [] } = data

  /* ── FINANCEIRO ── */
  if (tab === 'financeiro') {
    const realized = finTx.filter(t => t.status === 'received' || t.status === 'paid')
    const totalInc = realized.filter(t=>t.type==='income') .reduce((s,t)=>s+Number(t.amount),0)
    const totalExp = realized.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0)
    const balance  = totalInc - totalExp
    const margin   = totalInc > 0 ? (balance/totalInc*100).toFixed(1)+'%' : '—'
    const pending  = finTx.filter(t=>['pending','to_pay'].includes(t.status??'')).reduce((s,t)=>s+Number(t.amount),0)
    const incCount = realized.filter(t=>t.type==='income').length
    const ticket   = incCount > 0 ? totalInc/incCount : 0

    // Receitas/despesas por mês
    const monthMap: Record<string,{inc:number;exp:number}> = {}
    realized.forEach(t => {
      const k = (t.date as string)?.slice(0,7) ?? 'N/A'
      if (!monthMap[k]) monthMap[k] = {inc:0,exp:0}
      if (t.type==='income')  monthMap[k].inc += Number(t.amount)
      if (t.type==='expense') monthMap[k].exp += Number(t.amount)
    })

    // Categorias de despesas
    const catMap: Record<string,number> = {}
    realized.filter(t=>t.type==='expense').forEach(t => { catMap[t.category]=(catMap[t.category]||0)+Number(t.amount) })
    const catRows = Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,8)

    // Últimas 20 transações
    const txRows = [...realized].sort((a,b) => (b.date??'').localeCompare(a.date??'')).slice(0,20).map(t => [
      X(t.date?.split('T')[0] ?? ''),
      X(t.description ?? (t.type==='income'?'Receita':'Despesa')),
      X(t.category ?? ''),
      `<span style="color:${t.type==='income'?'#166534':'#b91c1c'};font-weight:600;">${t.type==='income'?'+':'-'}${R(t.amount)}</span>`,
      X(t.type==='income' ? (t.status==='received'?'Recebido':'Pendente') : (t.status==='paid'?'Pago':'A pagar')),
    ])

    return `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
        ${kpi('Receitas realizadas', R(totalInc), `${incCount} lançamentos`, '#166534')}
        ${kpi('Despesas realizadas', R(totalExp), '', '#b91c1c')}
        ${kpi('Saldo do período', R(balance), `Margem: ${margin}`, balance>=0?'#8B6C4F':'#b91c1c')}
        ${kpi('Pendentes', R(pending), '', '#a16207')}
      </div>
      ${section('Receitas vs Despesas por período')}
      ${barChart(Object.entries(monthMap).sort().flatMap(([k, _])=>[
        { label: k.slice(5)+'/'+k.slice(2,4)+' Rec', value: monthMap[k].inc, color: '#5C8B4F' },
        { label: k.slice(5)+'/'+k.slice(2,4)+' Desp', value: monthMap[k].exp, color: '#EF4444' },
      ]))}
      ${section('Despesas por categoria')}
      ${barChart(catRows.map(([label,value])=>({ label: X(label), value, color:'#8B6C4F' })))}
      ${section(`Últimas ${txRows.length} transações`)}
      ${table(['Data','Descrição','Categoria','Valor','Status'], txRows)}
      ${kpi('Ticket médio', R(ticket), 'Receitas realizadas', '#8B6C4F')}`
  }

  /* ── PEDIDOS ── */
  if (tab === 'pedidos') {
    const totalVal = orders.reduce((s,o)=>s+Number(o.total),0)
    const ticket   = orders.length > 0 ? totalVal/orders.length : 0
    const byStatus: Record<string,number> = {}
    orders.forEach(o=>{ byStatus[o.status]=(byStatus[o.status]||0)+1 })
    const statusLabels: Record<string,string> = { pending:'Pendente',production:'Produção',ready:'Pronto',delivered:'Entregue' }
    const orderRows = [...orders].sort((a,b)=>(b.created_at??'').localeCompare(a.created_at??'')).slice(0,30).map(o=>[
      X(o.order_number ?? '—'), X((o.customers as any)?.name??'—'),
      X(o.service_name??'—'), X(statusLabels[o.status]??o.status),
      `<strong>${R(o.total)}</strong>`,
      X(o.due_date?.split('T')[0]??'—'),
    ])
    return `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
        ${kpi('Total pedidos', N(orders.length), '', '#8B6C4F')}
        ${kpi('Valor total', R(totalVal), '', '#166534')}
        ${kpi('Ticket médio', R(ticket), '', '#8B6C4F')}
        ${kpi('Entregues', N(orders.filter(o=>o.status==='delivered').length), '', '#166534')}
      </div>
      ${section('Pedidos por status')}
      ${barChart(Object.entries(byStatus).map(([s,v])=>({label:statusLabels[s]??s,value:v,color:'#8B6C4F'})))}
      ${section('Lista de pedidos')}
      ${table(['Número','Cliente','Serviço','Status','Valor','Entrega'], orderRows)}`
  }

  /* ── CLIENTES ── */
  if (tab === 'clientes') {
    const byClient: Record<string,{name:string;count:number;total:number}> = {}
    orders.forEach(o=>{ const n=(o.customers as any)?.name??'Sem cliente'; if(!byClient[n]) byClient[n]={name:n,count:0,total:0}; byClient[n].count++; byClient[n].total+=Number(o.total) })
    const top = Object.values(byClient).sort((a,b)=>b.total-a.total).slice(0,15)
    const custRows = top.map(c=>[X(c.name),N(c.count),`<strong>${R(c.total)}</strong>`,R(c.count>0?c.total/c.count:0)])
    return `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
        ${kpi('Total clientes', N(customers.length), '', '#8B6C4F')}
        ${kpi('Com pedidos', N(top.length), 'No período', '#8B6C4F')}
        ${kpi('Valor total gerado', R(orders.reduce((s,o)=>s+Number(o.total),0)), '', '#166534')}
      </div>
      ${section('Top clientes por valor')}
      ${barChart(top.slice(0,10).map(c=>({ label:c.name.slice(0,18), value:c.total, color:'#8B6C4F' })))}
      ${section('Ranking de clientes')}
      ${table(['Cliente','Pedidos','Total','Ticket médio'], custRows)}`
  }

  /* ── PRODUTOS ── */
  if (tab === 'produtos') {
    const active = products.filter(p=>p.is_active)
    const withMargin = active.filter(p=>Number(p.final_price)>0).map(p=>({
      name: p.name, price: Number(p.final_price), cost: Number(p.total_cost),
      margin: Number(p.total_cost)>0 ? ((Number(p.final_price)-Number(p.total_cost))/Number(p.final_price)*100) : 0,
    })).sort((a,b)=>b.margin-a.margin)
    const avgMargin = withMargin.length>0 ? withMargin.reduce((s,p)=>s+p.margin,0)/withMargin.length : 0
    const prodRows = withMargin.slice(0,20).map(p=>[
      X(p.name), R(p.price), R(p.cost),
      `<span style="color:${p.margin>=40?'#166534':p.margin>=20?'#8B6C4F':'#b91c1c'};font-weight:600;">${p.margin.toFixed(1)}%</span>`,
    ])
    return `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
        ${kpi('Produtos ativos', N(active.length), '', '#8B6C4F')}
        ${kpi('Margem média', avgMargin.toFixed(1)+'%', '', avgMargin>=30?'#166534':'#b91c1c')}
        ${kpi('Ticket médio', active.length>0?R(active.reduce((s,p)=>s+Number(p.final_price),0)/active.length):R(0), '', '#8B6C4F')}
      </div>
      ${section('Margem de lucro por produto')}
      ${barChart(withMargin.slice(0,12).map(p=>({ label:String(p.name).slice(0,20), value:p.margin, color: p.margin>=40?'#5C8B4F':p.margin>=20?'#8B6C4F':'#EF4444' })))}
      ${section('Lista de produtos')}
      ${table(['Produto','Preço venda','Custo total','Margem'], prodRows)}`
  }

  /* ── ESTOQUE ── */
  if (tab === 'estoque') {
    const critical = inventory.filter(i=>i.status==='critical')
    const warning  = inventory.filter(i=>i.status==='warning')
    const totalCost = inventory.reduce((s,i)=>s+Number(i.cost_per_unit)*Number(i.quantity),0)
    const invRows  = [...inventory].sort((a,b)=>a.name?.localeCompare(b.name??'')??0).slice(0,30).map(i=>[
      X(i.name), X(i.category??'—'),
      `<span style="color:${i.status==='critical'?'#b91c1c':i.status==='warning'?'#a16207':'#166534'};font-weight:600;">${N(i.quantity)} ${X(i.unit??'')}</span>`,
      N(i.minimum_quantity)+' '+X(i.unit??''), R(i.cost_per_unit),
      `<span style="background:${i.status==='critical'?'#fee2e2':i.status==='warning'?'#fef9c3':'#dcfce7'};color:${i.status==='critical'?'#b91c1c':i.status==='warning'?'#a16207':'#166534'};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">${i.status==='critical'?'Crítico':i.status==='warning'?'Atenção':'Saudável'}</span>`,
    ])
    return `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
        ${kpi('Total de itens', N(inventory.length), '', '#8B6C4F')}
        ${kpi('Críticos', N(critical.length), 'Abaixo do mínimo', '#b91c1c')}
        ${kpi('Em atenção', N(warning.length), '', '#a16207')}
        ${kpi('Valor em estoque', R(totalCost), '', '#8B6C4F')}
      </div>
      ${critical.length+warning.length>0 ? `
        ${section('Itens que precisam de atenção')}
        ${table(['Material','Qtd atual','Qtd mínima','Status'],
          [...critical,...warning].map(i=>[X(i.name),N(i.quantity)+' '+X(i.unit??''),N(i.minimum_quantity)+' '+X(i.unit??''),
            i.status==='critical'?'<span style="color:#b91c1c;font-weight:700;">Crítico</span>':'<span style="color:#a16207;font-weight:700;">Atenção</span>'])
        )}` : ''}
      ${section('Inventário completo')}
      ${table(['Material','Categoria','Quantidade','Mínimo','Custo/un','Status'], invRows)}`
  }

  /* ── ORÇAMENTOS ── */
  if (tab === 'orcamentos') {
    const approved  = budgets.filter(b=>b.status==='approved'||b.status==='converted')
    const convRate  = budgets.length>0 ? (approved.length/budgets.length*100).toFixed(1)+'%' : '0%'
    const totalVal  = budgets.reduce((s,b)=>s+Number(b.total),0)
    const statusLabels: Record<string,string> = { draft:'Rascunho',sent:'Enviado',approved:'Aprovado',rejected:'Recusado',converted:'Convertido' }
    const byStatus: Record<string,number> = {}
    budgets.forEach(b=>{ byStatus[b.status]=(byStatus[b.status]||0)+1 })
    const budgRows = [...budgets].sort((a,b)=>(b.created_at??'').localeCompare(a.created_at??'')).slice(0,20).map(b=>[
      X((b.customers as any)?.name??'—'), X(statusLabels[b.status]??b.status),
      `<strong>${R(b.total)}</strong>`, X(b.created_at?.split('T')[0]??'—'),
    ])
    return `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
        ${kpi('Total orçamentos', N(budgets.length), '', '#8B6C4F')}
        ${kpi('Aprovados', N(approved.length), '', '#166534')}
        ${kpi('Conversão', convRate, '', '#8B6C4F')}
        ${kpi('Valor total', R(totalVal), '', '#166534')}
      </div>
      ${section('Por status')}
      ${barChart(Object.entries(byStatus).map(([s,v])=>({ label:statusLabels[s]??s, value:v, color:'#8B6C4F' })))}
      ${section('Lista de orçamentos')}
      ${table(['Cliente','Status','Valor','Emissão'], budgRows)}`
  }

  return '<p style="color:#aaa;">Selecione uma aba para exportar.</p>'
}

/* ══════════════════════════════════════════
   FUNÇÃO PRINCIPAL
══════════════════════════════════════════ */
export function generateReportPDF(data: ReportData) {
  const co      = data.company as any ?? {}
  const logoUrl = co.logo_url as string | undefined
  const coName  = String(co.name ?? 'Precy+')
  const primary = String(co.primary_color ?? '#8B6C4F')

  const title   = TAB_LABELS[data.tab]
  const period  = PERIOD_LABELS[data.period] ?? data.period
  const dateRng = `${data.start.split('-').reverse().join('/')} → ${data.end.split('-').reverse().join('/')}`

  const logoHTML = logoUrl
    ? `<img src="${logoUrl}" alt="${coName}" style="max-height:48px;max-width:140px;object-fit:contain;display:block;">`
    : `<div style="width:42px;height:42px;border-radius:10px;background:${primary};display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:700;">${coName.charAt(0).toUpperCase()}</div>`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${title} — ${coName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  @page{size:A4 portrait;margin:12mm 12mm 14mm 12mm;}
  @media print{
    html,body{background:#fff;}
    .no-print{display:none!important;}
    .page{margin:0!important;box-shadow:none!important;width:100%!important;}
    tr{page-break-inside:avoid;}
  }
  html,body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#ddd;
    color:#1a1208;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .toolbar{background:#1a1208;padding:11px 20px;position:sticky;top:0;z-index:99;
    display:flex;align-items:center;gap:10px;}
  .tb-title{color:rgba(255,255,255,.5);font-size:11.5px;margin-left:auto;}
  .btn{padding:8px 18px;border:none;border-radius:6px;font-size:12.5px;
    font-weight:600;cursor:pointer;font-family:inherit;}
  .btn-p{background:#fff;color:#1a1208;}
  .btn-c{background:transparent;color:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.2)!important;}
  .page{background:#fff;width:210mm;min-height:297mm;margin:20px auto;
    box-shadow:0 4px 40px rgba(0,0,0,.18);overflow:hidden;}
  .stripe{height:4px;background:${primary};}
  .hdr{display:table;width:100%;padding:18px 24px 14px;border-bottom:1px solid #ede9e3;}
  .hdr-l{display:table-cell;vertical-align:middle;width:50%;}
  .hdr-r{display:table-cell;vertical-align:middle;text-align:right;}
  .co-row{display:table;}
  .co-logo{display:table-cell;vertical-align:middle;padding-right:12px;}
  .co-info{display:table-cell;vertical-align:middle;}
  .co-name{font-size:14px;font-weight:700;color:#1a1208;}
  .co-sub{font-size:10px;color:#999;margin-top:2px;}
  .title-box{display:inline-block;text-align:right;}
  .title-label{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#bbb;}
  .title-main{font-size:17px;font-weight:700;color:#1a1208;}
  .title-sub{font-size:11px;color:#999;margin-top:2px;}
  .body{padding:20px 24px;}
  .footer{border-top:1px solid #ede9e3;padding:10px 24px;display:table;
    width:100%;background:#faf8f5;}
  .fl{display:table-cell;font-size:9.5px;color:#bbb;vertical-align:middle;}
  .fr{display:table-cell;text-align:right;font-size:9.5px;color:#bbb;vertical-align:middle;}
</style>
</head>
<body>
<div class="toolbar no-print">
  <button class="btn btn-p" onclick="window.print()">⬇ Baixar / Imprimir PDF</button>
  <button class="btn btn-c" onclick="window.close()">Fechar</button>
  <span class="tb-title">${title} · ${coName}</span>
</div>
<div class="page">
  <div class="stripe"></div>
  <div class="hdr">
    <div class="hdr-l">
      <div class="co-row">
        <div class="co-logo">${logoHTML}</div>
        <div class="co-info">
          <div class="co-name">${X(coName)}</div>
          <div class="co-sub">${X(co.cnpj ? 'CNPJ: '+co.cnpj : '')}${co.cnpj&&co.email?' · ':''}${X(co.email??'')}</div>
        </div>
      </div>
    </div>
    <div class="hdr-r">
      <div class="title-box">
        <div class="title-label">Relatório</div>
        <div class="title-main">${X(title.replace('Relatório ',''))}</div>
        <div class="title-sub">${X(period)} · ${X(dateRng)}</div>
      </div>
    </div>
  </div>
  <div class="body">
    ${buildBody(data)}
  </div>
  <div class="footer">
    <div class="fl">Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} · ${X(coName)}</div>
    <div class="fr">Relatório gerado pelo <strong>Precy+</strong></div>
  </div>
</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=980,height=760')
  if (win) { win.document.write(html); win.document.close(); win.focus() }
}
