'use client'
import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'
import { CheckCircle, Check, Lock, ArrowRight, Send, Loader2, Sparkles, ShieldCheck, TrendingDown } from 'lucide-react'

/* ── Types ─────────────────────────────── */
type Visibility = boolean | string
interface Feature { label: string; essencial: Visibility; pro: Visibility; highlight?: boolean }
type PlanId = 'essencial' | 'pro'

/* ── Data ─────────────────────────────────────────────────────────
   Preços e limites espelham lib/stripe/plans.ts (PLANS/PLAN_LIMITS) e os
   gates reais em middleware.ts — nunca prometer aqui o que o produto não
   libera de fato. O plano Basic saiu da landing a pedido da Jessica (fica
   só pra quem já é assinante, acessível em /configuracoes e no modal de
   upgrade — não é mais oferecido a quem chega pela página). Essencial é
   cobrado uma vez por ano (R$97); o equivalente mensal é só pra comparar
   visualmente com o Pro, que é mensal. ──────────────────────────── */
const PLAN_META: Record<PlanId, {
  name: string
  tagline: string
  price: string
  priceSuffix: string
  priceNote?: string
  badge?: string
  cta: string
}> = {
  essencial: {
    name: 'Essencial',
    tagline: 'Tudo que o seu negócio precisa pra organizar preço, estoque e pedidos — pagamento único no ano.',
    price: 'R$ 97',
    priceSuffix: '/ano',
    priceNote: '≈ R$ 8,08/mês — menos que uma assinatura de streaming',
    badge: 'Melhor custo-benefício',
    cta: 'Assinar Essencial',
  },
  pro: {
    name: 'Pro',
    tagline: 'Para quem já fatura bem e quer controle financeiro de verdade.',
    price: 'R$ 47',
    priceSuffix: '/mês',
    badge: 'Mais completo',
    cta: 'Desbloquear PRO',
  },
}

const PLAN_FEATURES: Record<PlanId, string[]> = {
  essencial: [
    'Dashboard com visão geral do negócio',
    'Precificação inteligente',
    'Produtos e pedidos sem limite apertado (até 50/mês)',
    'Controle de estoque',
    'Gestão de pedidos estilo Kanban',
    'Catálogo Online — sua vitrine virtual',
    'Cadastro de clientes e fornecedores',
    'Orçamentos profissionais em PDF',
    'Agenda integrada com os pedidos',
    'Financeiro completo (centro de custos, contas a receber)',
    'Relatórios financeiros completos',
    'Suporte por e-mail',
  ],
  pro: [
    'Tudo do Essencial, com pedidos ilimitados',
    'Financeiro avançado (fluxo de caixa, DRE, metas)',
    'Projeção de caixa e alertas automáticos',
    'Contas recorrentes e parcelamentos',
    'Biblioteca Precy+ com produtos prontos',
    'Conteúdos e cursos exclusivos',
    'Suporte prioritário via WhatsApp',
  ],
}

const COMPARE_GROUPS: { group: string; items: Feature[] }[] = [
  {
    group: 'Recursos principais',
    items: [
      { label: 'Dashboard com dados reais',   essencial: true,          pro: true },
      { label: 'Precificação inteligente',     essencial: true,          pro: true },
      { label: 'Controle de estoque',          essencial: true,          pro: true },
      { label: 'Kanban de pedidos',            essencial: true,          pro: true },
      { label: 'Clientes e fornecedores',      essencial: true,          pro: true },
      { label: 'Orçamentos profissionais PDF', essencial: true,          pro: true },
      { label: 'Pedidos por mês',              essencial: 'Até 50',      pro: '∞ Ilimitado' },
    ],
  },
  {
    group: 'Catálogo Online',
    items: [
      { label: 'Vitrine virtual com link próprio', essencial: true, pro: '🚀 Loja redesenhada (em breve)' },
    ],
  },
  {
    group: 'Agenda & Relatórios',
    items: [
      { label: 'Agenda integrada com pedidos',      essencial: true, pro: true },
      { label: 'Relatórios financeiros completos',  essencial: true, pro: true, highlight: true },
    ],
  },
  {
    group: 'Financeiro',
    items: [
      { label: 'Lançamentos e centro de custos',     essencial: true,  pro: true },
      { label: 'Contas a receber',                   essencial: true,  pro: true },
      { label: 'Financeiro avançado (DRE e metas)',  essencial: false, pro: true, highlight: true },
      { label: 'Fluxo de caixa e projeção 90 dias',  essencial: false, pro: true },
      { label: 'Contas recorrentes e parcelamentos', essencial: false, pro: true },
      { label: 'Alertas financeiros automáticos',    essencial: false, pro: true },
    ],
  },
  {
    group: 'Premium',
    items: [
      { label: 'Biblioteca Precy+',                essencial: false, pro: true },
      { label: 'Conteúdos exclusivos',             essencial: false, pro: true },
      { label: 'Suporte prioritário WhatsApp',     essencial: false, pro: true },
    ],
  },
]

const ROADMAP = [
  { emoji: '🏬', label: 'Loja Online PRO', desc: 'Vitrine redesenhada e exclusiva do plano PRO, além do Catálogo Online' },
  { emoji: '💳', label: 'Integração Mercado Pago', desc: 'Pagamento online integrado ao Catálogo Online' },
  { emoji: '🚚', label: 'Integração SuperFrete', desc: 'Cálculo automático de frete no Catálogo Online' },
  { emoji: '📲', label: 'WhatsApp', desc: 'Envio de orçamentos e atualizações pelo WhatsApp' },
  { emoji: '🧠', label: 'IA de Precificação', desc: 'Sugestão automática de preço por categoria' },
  { emoji: '✅', label: 'Módulo de Tarefas', desc: 'Lista de pendências do dia a dia, com vínculo a pedidos e clientes' },
]

const SUGGESTION_CATEGORIES = [
  'Nova funcionalidade', 'Melhoria de UX', 'Integração', 'Design', 'Performance', 'Outro',
]

/* ── Hook: intersection ─────────────────── */
function useVisible(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

/* ══════════════════════════════════════════
   PLAN CARD COMPONENT — 2 variantes visuais:
   Essencial (claro, com borda de destaque — é
   o plano de entrada agora), Pro (dark premium,
   pra quem quer tudo).
══════════════════════════════════════════ */
function PlanCard({
  plan, delay = 0, visible
}: {
  plan: PlanId; delay?: number; visible: boolean
}) {
  const meta = PLAN_META[plan]
  const isPro       = plan === 'pro'
  const isEssencial = plan === 'essencial'

  return (
    <div
      className="relative rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1"
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? (isEssencial ? 'translateY(0) scale(1.02)' : 'translateY(0)') : 'translateY(40px)',
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s, box-shadow 0.3s ease`,
        background: isPro ? 'linear-gradient(145deg, #2C2018, #3A2D22)' : 'white',
        border:     isPro ? '1px solid rgba(139,108,79,0.5)' : isEssencial ? '2px solid #8B6C4F' : '1px solid #EDE8E2',
        boxShadow:  isPro ? '0 0 60px rgba(139,108,79,0.2), inset 0 1px 0 rgba(255,255,255,0.05)'
                   : isEssencial ? '0 8px 50px rgba(139,108,79,0.22)' : '0 2px 20px rgba(0,0,0,0.05)',
      }}
      onMouseEnter={e => {
        if (isPro) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 80px rgba(139,108,79,0.35), inset 0 1px 0 rgba(255,255,255,0.05)'
        else if (isEssencial) (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 60px rgba(139,108,79,0.32)'
        else (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 40px rgba(139,108,79,0.12)'
      }}
      onMouseLeave={e => {
        if (isPro) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 60px rgba(139,108,79,0.2), inset 0 1px 0 rgba(255,255,255,0.05)'
        else if (isEssencial) (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 50px rgba(139,108,79,0.22)'
        else (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 20px rgba(0,0,0,0.05)'
      }}
    >
      {/* Top accent bar */}
      {(isPro || isEssencial) && (
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, transparent, #8B6C4F, #C4A47B, transparent)' }} />
      )}

      <div className="p-7 flex flex-col flex-1">
        {/* Badges */}
        <div className="flex items-center justify-between mb-5 gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
            isPro
              ? 'bg-[rgba(139,108,79,0.2)] text-[#C4A47B]'
              : 'bg-[rgba(92,139,79,0.12)] text-[#5C8B4F]'
          }`}>
            {isPro ? '🚀' : '💎'} 7 dias grátis para testar
          </span>
          {meta.badge && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full text-white whitespace-nowrap"
              style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)' }}>
              <Sparkles size={9} /> {meta.badge}
            </span>
          )}
        </div>

        {/* Name + description */}
        <h3 className={`text-2xl font-bold mb-1.5 ${isPro ? 'text-stone-100' : 'text-[#2C2018]'}`}>
          {meta.name}
        </h3>
        <p className={`text-sm leading-relaxed mb-6 ${isPro ? 'text-stone-400' : 'text-[#7A6855]'}`}>
          {meta.tagline}
        </p>

        {/* Price */}
        <div className="mb-1.5">
          <div className="flex items-end gap-1.5">
            <span className={`text-5xl font-black tracking-tight ${isPro ? 'text-stone-100' : 'text-[#2C2018]'}`}>
              {meta.price}
            </span>
            <span className={`mb-2 text-sm ${isPro ? 'text-stone-500' : 'text-[#B8A898]'}`}>{meta.priceSuffix}</span>
          </div>
          {isPro && (
            <p className="text-xs font-semibold" style={{ color: '#8B6C4F' }}>
              ≈ R$ 1,56/dia — menos que um café ☕
            </p>
          )}
          {isEssencial && (
            <p className="text-xs font-bold flex items-center gap-1" style={{ color: '#5C8B4F' }}>
              <TrendingDown size={12} /> {meta.priceNote}
            </p>
          )}
        </div>

        {/* CTA */}
        <Link
          href="/cadastro"
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm mt-5 mb-7 transition-all duration-200 group"
          style={isPro || isEssencial ? {
            background: 'linear-gradient(135deg, #8B6C4F, #B8956A)',
            boxShadow: '0 4px 20px rgba(139,108,79,0.4)',
            color: 'white',
          } : {
            border: '2px solid #8B6C4F',
            color: '#8B6C4F',
            background: 'transparent',
          }}
          onMouseEnter={e => {
            if (!isPro && !isEssencial) {
              (e.currentTarget as HTMLElement).style.background = '#8B6C4F'
              ;(e.currentTarget as HTMLElement).style.color = 'white'
            }
          }}
          onMouseLeave={e => {
            if (!isPro && !isEssencial) {
              (e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.color = '#8B6C4F'
            }
          }}
        >
          {meta.cta}
          <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>

        {/* Features */}
        <ul className="space-y-2.5 flex-1">
          {PLAN_FEATURES[plan].map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm">
              <CheckCircle
                size={15}
                className="flex-shrink-0 mt-0.5"
                style={{ color: isPro ? '#8B6C4F' : '#5C8B4F' }}
              />
              <span style={{ color: isPro ? '#C4B8AC' : '#5A4A3B' }}>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   1. PRICING — seção isolada para ficar logo
      antes do CTA final (momento de maior
      intenção de compra, depois de ver o preço)
══════════════════════════════════════════ */
export function PricingSection() {
  const { ref: plansRef, visible: plansVisible } = useVisible()

  return (
    <>
      {/* ─────────────────────────────────────
          1. PLANOS
      ───────────────────────────────────── */}
      <section id="planos" ref={plansRef} className="py-24 px-4 sm:px-6" style={{ background: '#FAF7F4' }}>
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-14"
            style={{ opacity: plansVisible ? 1 : 0, transform: plansVisible ? 'translateY(0)' : 'translateY(24px)', transition: 'all 0.5s ease' }}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full mb-4"
              style={{ background: 'rgba(139,108,79,0.1)', color: '#8B6C4F' }}>
              💳 Planos e preços
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#2C2018' }}>
              Comece grátis, cresça no seu ritmo
            </h2>
            <p className="max-w-xl mx-auto" style={{ color: '#7A6855' }}>
              7 dias grátis em qualquer plano. Sem cartão de crédito. Cancele quando quiser.
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto gap-6 mb-8 items-stretch">
            <PlanCard plan="essencial" delay={0.1}  visible={plansVisible} />
            <PlanCard plan="pro"       delay={0.2}  visible={plansVisible} />
          </div>

          {/* Destaque do Essencial — a conta que fecha sozinha */}
          <div className="mb-8 rounded-2xl border flex flex-col sm:flex-row items-center gap-4 p-5 text-center sm:text-left max-w-3xl mx-auto"
            style={{ background: 'rgba(139,108,79,0.06)', borderColor: 'rgba(139,108,79,0.25)' }}>
            <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(139,108,79,0.16)' }}>
              <TrendingDown size={20} style={{ color: '#8B6C4F' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#2C2018' }}>
                R$97 por ano, parcelado em nenhuma vez — menos de R$9/mês pra ter tudo isso
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#7A6855' }}>
                Produtos sem limite apertado, Catálogo Online, Agenda e Financeiro completo — tudo
                num único pagamento anual. Testa 7 dias grátis antes de decidir qualquer coisa.
              </p>
            </div>
          </div>

          {/* Garantia — risco zero na decisão */}
          <div className="mb-12 rounded-2xl border flex flex-col sm:flex-row items-center gap-4 p-5 text-center sm:text-left"
            style={{ background: 'rgba(92,139,79,0.06)', borderColor: 'rgba(92,139,79,0.2)' }}>
            <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(92,139,79,0.14)' }}>
              <ShieldCheck size={20} style={{ color: '#5C8B4F' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#2C2018' }}>
                Garantia de 7 dias — reembolso 100%, em qualquer plano
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#7A6855' }}>
                Testou grátis, assinou e não era pra você? Cancele nos primeiros 7 dias após a
                primeira cobrança e devolvemos o valor integral, sem perguntas.{' '}
                <a href="/reembolso" className="underline font-semibold" style={{ color: '#5C8B4F' }}>
                  Ver política completa
                </a>
              </p>
            </div>
          </div>

          {/* Tabela comparativa por grupos */}
          <div
            className="rounded-2xl overflow-hidden border shadow-sm"
            style={{
              borderColor: '#EDE8E2',
              opacity: plansVisible ? 1 : 0,
              transform: plansVisible ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.6s ease 0.35s',
            }}
          >
            {/* Header fixo */}
            <div className="grid grid-cols-[1.6fr_1fr_1fr] sm:grid-cols-[2.1fr_1fr_1fr]" style={{ background: '#2C2018' }}>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider px-3 sm:px-4 py-4 flex items-end"
                style={{ color: 'rgba(255,255,255,0.45)' }}>
                Funcionalidade
              </p>
              <div className="flex flex-col items-center justify-center gap-0.5 py-3.5 border-l"
                style={{
                  borderColor: 'rgba(255,255,255,0.08)',
                  background: 'linear-gradient(180deg, rgba(184,149,106,0.4), rgba(139,108,79,0.15))',
                }}>
                <span className="text-[11px] sm:text-xs font-black flex items-center gap-1" style={{ color: '#F3DFC0' }}>💎 Essencial</span>
                <span className="text-[9px] font-semibold" style={{ color: '#C4A47B' }}>R$97/ano</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-0.5 py-3.5 border-l" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <span className="text-[11px] sm:text-xs font-bold" style={{ color: '#D8CFC2' }}>🚀 Pro</span>
                <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>R$47/mês</span>
              </div>
            </div>

            {COMPARE_GROUPS.map(group => (
              <div key={group.group}>
                {/* Group header */}
                <div className="px-3 sm:px-4 py-2 border-b border-t" style={{ background: '#F5F0EB', borderColor: '#EDE8E2' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8B6C4F' }}>{group.group}</p>
                </div>
                {/* Group rows */}
                {group.items.map((f, i) => (
                  <div key={f.label}
                    className="grid grid-cols-[1.6fr_1fr_1fr] sm:grid-cols-[2.1fr_1fr_1fr] items-stretch border-b last:border-0 transition-colors hover:bg-black/[0.015]"
                    style={{
                      borderColor: '#EDE8E2',
                      background: f.highlight ? 'rgba(139,108,79,0.045)' : i % 2 === 0 ? 'white' : 'rgba(139,108,79,0.012)',
                    }}>
                    <span className="text-xs px-3 sm:px-4 py-3 flex items-center" style={{ color: f.highlight ? '#2C2018' : '#5A4A3B', fontWeight: f.highlight ? 600 : 400 }}>
                      {f.label}
                    </span>
                    {/* Essencial */}
                    <FeatureCell value={f.essencial} variant="essencial" />
                    {/* Pro */}
                    <FeatureCell value={f.pro} variant="pro" />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Pro lock hint */}
          <div className="mt-8 p-4 rounded-2xl border flex items-start gap-3"
            style={{ background: 'rgba(139,108,79,0.04)', borderColor: 'rgba(139,108,79,0.15)' }}>
            <Lock size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#8B6C4F' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#2C2018' }}>
                Funcionalidades bloqueadas aparecem no sistema
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#7A6855' }}>
                Nos planos abaixo, as funcionalidades de planos superiores aparecem com o ícone{' '}
                <span className="font-bold" style={{ color: '#8B6C4F' }}>🔒</span>{' '}
                e um blur elegante. Um clique te leva diretamente para o upgrade.
              </p>
            </div>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: '#B8A898' }}>
            Pagamento seguro via Stripe · Cancele quando quiser · Sem fidelidade · Sem cartão no trial
          </p>
        </div>
      </section>
    </>
  )
}

/* Célula da tabela comparativa — extraída porque repete 2x por linha
   (Essencial/Pro) e o destaque visual do Essencial precisa de um fundo
   levemente diferente do Pro pra guiar o olho até ele. */
function FeatureCell({ value, variant }: { value: Visibility; variant: PlanId }) {
  const bg = variant === 'essencial' ? 'rgba(139,108,79,0.06)' : variant === 'pro' ? 'rgba(139,108,79,0.04)' : undefined
  return (
    <div className="flex items-center justify-center py-3 border-l" style={{ borderColor: '#EDE8E2', background: bg }}>
      {value === true && (
        <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: variant === 'essencial' ? 'linear-gradient(135deg, #8B6C4F, #B8956A)' : 'rgba(92,139,79,0.14)' }}>
          <Check size={12} strokeWidth={3} className={variant === 'essencial' ? 'text-white' : ''} style={variant === 'essencial' ? {} : { color: '#5C8B4F' }} />
        </span>
      )}
      {value === false && (
        <span title="Não incluso neste plano">
          <Lock size={12} style={{ color: '#D0C4B4' }} />
        </span>
      )}
      {typeof value === 'string' && (
        <span className="text-[10px] font-bold text-center px-1" style={{ color: '#8B6C4F' }}>{value}</span>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   2. ROADMAP — conteúdo secundário. Fica
      DEPOIS do CTA final de propósito: mostrar
      "o que ainda falta" antes de pedir o
      cadastro reduz a confiança no produto.
══════════════════════════════════════════ */
export function RoadmapSection() {
  const { ref: roadmapRef, visible: roadmapVisible } = useVisible()

  return (
      <section ref={roadmapRef} className="py-24 px-4 sm:px-6" style={{ background: 'white' }}>
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12"
            style={{ opacity: roadmapVisible ? 1 : 0, transform: roadmapVisible ? 'none' : 'translateY(24px)', transition: 'all 0.5s ease' }}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full mb-4"
              style={{ background: 'rgba(139,108,79,0.08)', color: '#8B6C4F' }}>
              🗺️ Em construção
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: '#2C2018' }}>
              🚀 Roadmap PRECY+
            </h2>
            <p className="max-w-lg mx-auto text-sm" style={{ color: '#7A6855' }}>
              Próximas atualizações planejadas para evoluir o PRECY+.
              Cada mês novas funcionalidades chegam.
            </p>
          </div>

          {/* Grid de cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {ROADMAP.map((item, i) => (
              <div
                key={item.label}
                className="group p-4 rounded-2xl border cursor-default transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  borderColor: '#EDE8E2',
                  background: 'white',
                  opacity: roadmapVisible ? 1 : 0,
                  transform: roadmapVisible ? 'translateY(0)' : 'translateY(20px)',
                  transition: `opacity 0.5s ease ${Math.min(i * 0.03, 0.4)}s, transform 0.5s ease ${Math.min(i * 0.03, 0.4)}s, box-shadow 0.2s ease`,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(139,108,79,0.1)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}
              >
                <span className="text-2xl mb-2 block">{item.emoji}</span>
                <p className="text-xs font-semibold mb-1" style={{ color: '#2C2018' }}>{item.label}</p>
                <p className="text-[10px] leading-relaxed" style={{ color: '#B8A898' }}>{item.desc}</p>
                <div className="mt-2.5 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#8B6C4F', opacity: 0.4 }} />
                  <span className="text-[9px] font-semibold" style={{ color: '#B8A898' }}>Em breve</span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <p className="text-sm" style={{ color: '#7A6855' }}>
              Tem uma ideia que deveria estar aqui?{' '}
              <a href="#sugestoes" className="font-semibold underline" style={{ color: '#8B6C4F' }}>
                Manda sua sugestão 💡
              </a>
            </p>
          </div>
        </div>
      </section>
  )
}

/* ══════════════════════════════════════════
   3. SUGESTÕES E IDEIAS — também secundário,
      fica após o CTA final.
══════════════════════════════════════════ */
export function SuggestionsSection() {
  const { ref: suggRef, visible: suggVisible } = useVisible()

  const [name, setName]       = useState('')
  const [suggestion, setS]    = useState('')
  const [category, setCategory] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!suggestion.trim()) return
    setSending(true)
    setTimeout(() => {
      setSending(false)
      setSent(true)
      setName(''); setS(''); setCategory('')
      setTimeout(() => setSent(false), 6000)
    }, 1500)
  }

  return (
      <section id="sugestoes" ref={suggRef} className="py-24 px-4 sm:px-6" style={{ background: '#FAF7F4' }}>
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10"
            style={{ opacity: suggVisible ? 1 : 0, transform: suggVisible ? 'none' : 'translateY(24px)', transition: 'all 0.5s ease' }}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full mb-4"
              style={{ background: 'rgba(92,139,79,0.1)', color: '#5C8B4F' }}>
              💡 Comunidade
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: '#2C2018' }}>
              Sugestões e ideias
            </h2>
            <p className="text-sm" style={{ color: '#7A6855' }}>
              Ajude a construir o futuro do PRECY+. Sua sugestão pode virar uma funcionalidade real.
            </p>
          </div>

          {/* Form card */}
          <div
            className="rounded-2xl border p-6 sm:p-8"
            style={{
              background: 'white',
              borderColor: '#EDE8E2',
              boxShadow: '0 4px 32px rgba(139,108,79,0.06)',
              opacity: suggVisible ? 1 : 0,
              transform: suggVisible ? 'none' : 'translateY(24px)',
              transition: 'all 0.5s ease 0.15s',
            }}
          >
            {sent ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🎉</div>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#2C2018' }}>
                  Obrigado pela sugestão 💚
                </h3>
                <p className="text-sm" style={{ color: '#7A6855' }}>
                  Estamos evoluindo o PRECY+ constantemente. Sua ideia foi recebida!
                </p>
              </div>
            ) : (
              <form onSubmit={handleSend} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#7A6855' }}>
                      Seu nome (opcional)
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                      placeholder="Como posso te chamar?"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      style={{
                        border: '1.5px solid #EDE8E2',
                        background: '#FAF7F4',
                        color: '#2C2018',
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = '#8B6C4F')}
                      onBlur={e => (e.currentTarget.style.borderColor = '#EDE8E2')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#7A6855' }}>
                      Categoria (opcional)
                    </label>
                    <select
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      style={{
                        border: '1.5px solid #EDE8E2',
                        background: '#FAF7F4',
                        color: category ? '#2C2018' : '#B8A898',
                      }}
                    >
                      <option value="">Selecionar...</option>
                      {SUGGESTION_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#7A6855' }}>
                    Sua sugestão *
                  </label>
                  <textarea
                    rows={4}
                    required
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none"
                    placeholder="Conte sua ideia, sugestão ou melhoria... Quanto mais detalhe, melhor!"
                    value={suggestion}
                    onChange={e => setS(e.target.value)}
                    style={{
                      border: '1.5px solid #EDE8E2',
                      background: '#FAF7F4',
                      color: '#2C2018',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#8B6C4F')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#EDE8E2')}
                  />
                  <p className="text-[10px] mt-1" style={{ color: '#B8A898' }}>
                    {suggestion.length}/500 caracteres
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={sending || !suggestion.trim()}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, #5C8B4F, #7AAA6A)',
                    boxShadow: suggestion.trim() ? '0 4px 20px rgba(92,139,79,0.3)' : 'none',
                  }}
                >
                  {sending ? (
                    <><Loader2 size={15} className="animate-spin" /> Enviando...</>
                  ) : (
                    <><Send size={14} /> Enviar sugestão</>
                  )}
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-xs mt-5" style={{ color: '#B8A898' }}>
            As sugestões mais votadas entram no roadmap. Obrigado por fazer parte do PRECY+ 💚
          </p>
        </div>
      </section>
  )
}
