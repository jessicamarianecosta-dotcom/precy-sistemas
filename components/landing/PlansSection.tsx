'use client'
import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'
import { CheckCircle, Lock, Zap, ArrowRight, Send, Loader2, Sparkles } from 'lucide-react'

/* ── Types ─────────────────────────────── */
type Visibility = boolean | string
interface Feature { label: string; basic: Visibility; pro: Visibility; highlight?: boolean }

/* ── Data ─────────────────────────────── */
const BASIC_FEATURES = [
  'Dashboard com visão geral do negócio',
  'Cadastro de produtos',
  'Controle de estoque',
  'Precificação inteligente',
  'Gestão de pedidos estilo Kanban',
  'Até 30 pedidos por mês',
  'Até 20 produtos cadastrados',
  'Atualização em tempo real',
  'Layout premium responsivo',
  'Uso no celular e computador',
  'Sistema rápido e leve',
  'Suporte por e-mail',
]

const PRO_FEATURES = [
  'Tudo do Basic',
  'Produtos ilimitados',
  'Pedidos ilimitados',
  'Cadastro completo de clientes',
  'Histórico de clientes e pedidos',
  'Agenda integrada com pedidos e entregas',
  'Controle financeiro básico',
  'Registro de entradas e saídas',
  'Status de pedidos e orçamentos',
  'Orçamentos profissionais em PDF',
  'Biblioteca de conteúdos de gestão e precificação',
  'Suporte por e-mail e WhatsApp',
]

const COMPARE: Feature[] = [
  { label: 'Dashboard com dados reais',    basic: true,     pro: true     },
  { label: 'Precificação inteligente',     basic: true,     pro: true     },
  { label: 'Controle de estoque',          basic: true,     pro: true     },
  { label: 'Kanban de pedidos',            basic: true,     pro: true     },
  { label: 'Orçamentos em PDF',            basic: false,    pro: true,    highlight: true },
  { label: 'Financeiro completo',          basic: false,    pro: true,    highlight: true },
  { label: 'Cadastro de clientes',         basic: false,    pro: true,    highlight: true },
  { label: 'Relatórios avançados',         basic: false,    pro: true,    highlight: true },
  { label: 'Sem marca d\'água no PDF',     basic: false,    pro: true     },
  { label: 'Suporte prioritário',          basic: false,    pro: true     },
  { label: 'Número de produtos',           basic: 'Até 20', pro: '∞ Ilimitado' },
  { label: 'Pedidos por mês',              basic: 'Até 30', pro: '∞ Ilimitado' },
  { label: 'IA de precificação',           basic: false,    pro: 'coming' },
  { label: 'WhatsApp integrado',           basic: false,    pro: 'coming' },
  { label: 'Agenda de entregas',           basic: false,    pro: 'coming' },
]

const ROADMAP = [
  { emoji: '🧠', label: 'IA de precificação', desc: 'Sugestão automática de preço por categoria' },
  { emoji: '📲', label: 'WhatsApp integrado', desc: 'Envio de orçamentos e atualizações pelo WhatsApp' },
  { emoji: '🛍️', label: 'Catálogo online', desc: 'Link público do seu catálogo para clientes' },
  { emoji: '📦', label: 'Agenda de entregas', desc: 'Calendário inteligente para organizar produções' },
  { emoji: '📈', label: 'Relatórios inteligentes', desc: 'Análises detalhadas do seu negócio' },
  { emoji: '🤖', label: 'Automação de mensagens', desc: 'Lembretes e follow-ups automáticos' },
  { emoji: '💰', label: 'Financeiro avançado', desc: 'Fluxo de caixa, DRE e projeções' },
  { emoji: '📊', label: 'Metas e evolução', desc: 'Acompanhe seu crescimento mensal' },
  { emoji: '🔔', label: 'Alertas automáticos', desc: 'Notificações de estoque, prazos e pagamentos' },
  { emoji: '📱', label: 'App mobile', desc: 'Aplicativo nativo para iOS e Android' },
  { emoji: '☁️', label: 'Backup automático', desc: 'Seus dados sempre seguros na nuvem' },
  { emoji: '👥', label: 'Multiusuários', desc: 'Adicione colaboradores com permissões' },
  { emoji: '📎', label: 'Upload de arquivos', desc: 'Anexe artes e documentos nos pedidos' },
  { emoji: '🎨', label: 'PDFs personalizados', desc: 'Customize o layout dos seus orçamentos' },
  { emoji: '🧾', label: 'Histórico completo', desc: 'Rastreie todas as alterações do sistema' },
  { emoji: '📅', label: 'Calendário de produção', desc: 'Planeje sua semana de produção visualmente' },
  { emoji: '🚚', label: 'Rastreamento de entregas', desc: 'Acompanhe o status de cada entrega' },
  { emoji: '⭐', label: 'Área do cliente', desc: 'Portal exclusivo para seus clientes' },
  { emoji: '📥', label: 'Pedidos pelo catálogo', desc: 'Clientes fazem pedidos direto do seu catálogo' },
  { emoji: '🔄', label: 'Pedidos recorrentes', desc: 'Configure pedidos que se repetem automaticamente' },
  { emoji: '🏷️', label: 'Cupons e descontos', desc: 'Crie promoções e cupons para clientes' },
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
   PLAN CARD COMPONENT
══════════════════════════════════════════ */
function PlanCard({
  plan, delay = 0, visible
}: {
  plan: 'basic' | 'pro'; delay?: number; visible: boolean
}) {
  const isPro = plan === 'pro'

  return (
    <div
      className="relative rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1"
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? `translateY(0)` : `translateY(40px)`,
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s, box-shadow 0.3s ease`,
        background: isPro ? 'linear-gradient(145deg, #2C2018, #3A2D22)' : 'white',
        border:     isPro ? '1px solid rgba(139,108,79,0.5)' : '1px solid #EDE8E2',
        boxShadow:  isPro ? '0 0 60px rgba(139,108,79,0.2), inset 0 1px 0 rgba(255,255,255,0.05)' : '0 2px 20px rgba(0,0,0,0.05)',
      }}
      onMouseEnter={e => {
        if (isPro) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 80px rgba(139,108,79,0.35), inset 0 1px 0 rgba(255,255,255,0.05)'
        else (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 40px rgba(139,108,79,0.12)'
      }}
      onMouseLeave={e => {
        if (isPro) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 60px rgba(139,108,79,0.2), inset 0 1px 0 rgba(255,255,255,0.05)'
        else (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 20px rgba(0,0,0,0.05)'
      }}
    >
      {/* Top accent bar (Pro only) */}
      {isPro && (
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #8B6C4F, #C4A47B, transparent)' }} />
      )}

      <div className="p-7 flex flex-col flex-1">
        {/* Badges */}
        <div className="flex items-center justify-between mb-5">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
            isPro
              ? 'bg-[rgba(139,108,79,0.2)] text-[#C4A47B]'
              : 'bg-[rgba(92,139,79,0.12)] text-[#5C8B4F]'
          }`}>
            {isPro ? '🚀' : '🌱'} 7 dias grátis para testar
          </span>
          {isPro && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full text-white"
              style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)' }}>
              <Sparkles size={9} /> Mais popular
            </span>
          )}
        </div>

        {/* Name + description */}
        <h3 className={`text-2xl font-bold mb-1.5 ${isPro ? 'text-stone-100' : 'text-[#2C2018]'}`}>
          {isPro ? 'Pro' : 'Basic'}
        </h3>
        <p className={`text-sm leading-relaxed mb-6 ${isPro ? 'text-stone-400' : 'text-[#7A6855]'}`}>
          {isPro
            ? 'Para empresas que querem mais controle, profissionalismo e organização no dia a dia.'
            : 'Ideal para quem está começando e precisa organizar pedidos, produtos e preços de forma simples e rápida.'
          }
        </p>

        {/* Price */}
        <div className="mb-1.5">
          <div className="flex items-end gap-1.5">
            <span className={`text-5xl font-black tracking-tight ${isPro ? 'text-stone-100' : 'text-[#2C2018]'}`}>
              R$ {isPro ? '37' : '17'}
            </span>
            <span className={`mb-2 text-sm ${isPro ? 'text-stone-500' : 'text-[#B8A898]'}`}>/mês</span>
          </div>
          {isPro && (
            <p className="text-xs font-semibold" style={{ color: '#8B6C4F' }}>
              = R$ 1,23/dia — menos que um café ☕
            </p>
          )}
        </div>

        {/* CTA */}
        <Link
          href="/cadastro"
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm mt-5 mb-7 transition-all duration-200 group"
          style={isPro ? {
            background: 'linear-gradient(135deg, #8B6C4F, #B8956A)',
            boxShadow: '0 4px 20px rgba(139,108,79,0.4)',
            color: 'white',
          } : {
            border: '2px solid #8B6C4F',
            color: '#8B6C4F',
            background: 'transparent',
          }}
          onMouseEnter={e => {
            if (!isPro) {
              (e.currentTarget as HTMLElement).style.background = '#8B6C4F'
              ;(e.currentTarget as HTMLElement).style.color = 'white'
            }
          }}
          onMouseLeave={e => {
            if (!isPro) {
              (e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.color = '#8B6C4F'
            }
          }}
        >
          {isPro ? 'Desbloquear PRO' : 'Começar grátis'}
          <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>

        {/* Features */}
        <ul className="space-y-2.5 flex-1">
          {(isPro ? PRO_FEATURES : BASIC_FEATURES).map((f, i) => (
            <li key={f} className="flex items-start gap-2.5 text-sm"
              style={{ animationDelay: `${i * 30}ms` }}>
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
   MAIN EXPORT
══════════════════════════════════════════ */
export function PlansSection() {
  const { ref: plansRef, visible: plansVisible } = useVisible()
  const { ref: roadmapRef, visible: roadmapVisible } = useVisible()
  const { ref: suggRef, visible: suggVisible } = useVisible()

  /* Suggestion form */
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
    <>
      {/* ─────────────────────────────────────
          1. PLANOS
      ───────────────────────────────────── */}
      <section id="planos" ref={plansRef} className="py-24 px-4 sm:px-6" style={{ background: '#FAF7F4' }}>
        <div className="max-w-5xl mx-auto">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <PlanCard plan="basic" delay={0.1} visible={plansVisible} />
            <PlanCard plan="pro"   delay={0.2} visible={plansVisible} />
          </div>

          {/* Tabela comparativa */}
          <div
            className="rounded-2xl overflow-hidden border"
            style={{
              borderColor: '#EDE8E2',
              opacity: plansVisible ? 1 : 0,
              transform: plansVisible ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.6s ease 0.35s',
            }}
          >
            {/* Header */}
            <div className="grid grid-cols-3 p-4 border-b" style={{ background: '#F5F0EB', borderColor: '#EDE8E2' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#B8A898' }}>Funcionalidade</p>
              <p className="text-xs font-semibold text-center" style={{ color: '#7A6855' }}>Basic</p>
              <p className="text-xs font-semibold text-center" style={{ color: '#8B6C4F' }}>Pro</p>
            </div>
            {COMPARE.map((f, i) => (
              <div key={f.label}
                className="grid grid-cols-3 px-4 py-3 items-center border-b last:border-0"
                style={{
                  borderColor: '#EDE8E2',
                  background: i % 2 === 0 ? 'white' : 'rgba(139,108,79,0.015)',
                }}>
                <span className="text-xs" style={{ color: '#2C2018' }}>{f.label}</span>
                {/* Basic */}
                <div className="text-center">
                  {f.basic === true  && <span style={{ color: '#5C8B4F', fontSize: 16 }}>✓</span>}
                  {f.basic === false && <span style={{ color: '#EDE8E2' }}>—</span>}
                  {typeof f.basic === 'string' && <span className="text-[10px] font-medium" style={{ color: '#7A6855' }}>{f.basic}</span>}
                </div>
                {/* Pro */}
                <div className="text-center">
                  {f.pro === true  && <span className="font-bold" style={{ color: '#8B6C4F', fontSize: 16 }}>✓</span>}
                  {f.pro === false && <span style={{ color: '#EDE8E2' }}>—</span>}
                  {f.pro === 'coming' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(139,108,79,0.1)', color: '#8B6C4F' }}>
                      Em breve
                    </span>
                  )}
                  {typeof f.pro === 'string' && f.pro !== 'coming' && (
                    <span className="text-[10px] font-bold" style={{ color: '#8B6C4F' }}>{f.pro}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pro lock hint */}
          <div className="mt-8 p-4 rounded-2xl border flex items-start gap-3"
            style={{ background: 'rgba(139,108,79,0.04)', borderColor: 'rgba(139,108,79,0.15)' }}>
            <Lock size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#8B6C4F' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#2C2018' }}>
                Funcionalidades PRO bloqueadas no Basic
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#7A6855' }}>
                No plano Basic, as funcionalidades PRO aparecem com o ícone{' '}
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

      {/* ─────────────────────────────────────
          2. ROADMAP
      ───────────────────────────────────── */}
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

      {/* ─────────────────────────────────────
          3. SUGESTÕES E IDEIAS
      ───────────────────────────────────── */}
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
    </>
  )
}
