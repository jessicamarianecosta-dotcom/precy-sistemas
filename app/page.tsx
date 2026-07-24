import Link from 'next/link'
import type { Metadata } from 'next'
import { HeroDashboard } from '@/components/landing/HeroDashboard'
import { PainSection } from '@/components/landing/PainSection'
import { StatsSection } from '@/components/landing/StatsSection'
import { LivePreview } from '@/components/landing/LivePreview'
import { PlansSection } from '@/components/landing/PlansSection'
import { AppCalloutSection } from '@/components/landing/AppCalloutSection'

export const metadata: Metadata = {
  title: 'Precy+ Sistemas — Precificação e Gestão para Pequenos Negócios',
  description:
    'SaaS premium de precificação inteligente, estoque, pedidos, orçamentos em PDF e financeiro para artesãs, papelaria, cosméticos e pequenos negócios.',
}

/* ─── Features ─── */
const features = [
  {
    icon: '💰',
    title: 'Precificação Inteligente',
    description:
      'Calcule o preço ideal com base em materiais, mão de obra e custos fixos. Gere 3 cenários automaticamente.',
  },
  {
    icon: '📦',
    title: 'Estoque Inteligente',
    description:
      'Controle materiais com alertas crítico, atenção e saudável. Nunca fique sem insumos no meio de um pedido.',
  },
  {
    icon: '🛒',
    title: 'Pedidos com Kanban',
    description:
      'Organize pedidos em Kanban arrastar e soltar: Pendente → Produção → Pronto → Entregue.',
  },
  {
    icon: '📄',
    title: 'Orçamentos em PDF',
    description:
      'Gere orçamentos profissionais com PDF premium, logo da empresa e todos os itens calculados em 1 clique.',
  },
  {
    icon: '💵',
    title: 'Financeiro Completo',
    description:
      'Exclusivo do Plano PRO: fluxo de caixa, contas a pagar e receber, centros de custo, parcelamentos, relatórios financeiros e análises avançadas.',
    badge: { label: '⭐ Exclusivo PRO', color: '#8B6C4F' },
  },
  {
    icon: '📊',
    title: 'Dashboard com Dados Reais',
    description:
      'Faturamento, lucro, pedidos ativos e alertas em cards e gráficos atualizados automaticamente.',
  },
  {
    icon: '🛍️',
    title: 'Catálogo Online',
    description:
      'Em breve você poderá criar sua loja virtual integrada ao Precy+, publicar produtos, receber pedidos online, integrar pagamentos e calcular fretes automaticamente.',
    badge: { label: '🚀 Em breve', color: '#5C8B4F' },
  },
  {
    icon: '📚',
    title: 'Biblioteca Precy+',
    description:
      'Biblioteca exclusiva com centenas de produtos prontos para importar, agilizando o cadastro e a precificação.',
    badge: { label: '⭐ Exclusivo PRO', color: '#8B6C4F' },
  },
]

/* ─── Testimonials ─── */
const testimonials = [
  {
    name: 'Ana Clara',
    role: 'Papelaria personalizada',
    text: 'Antes eu chutava o preço e ficava no prejuízo. Com o Precy+ eu finalmente sei o que cobrar e ainda organizo todos os meus pedidos num só lugar.',
    avatar: 'AC',
    saved: 'Economizou R$420/mês',
  },
  {
    name: 'Fernanda Lima',
    role: 'Velas artesanais',
    text: 'O orçamento em PDF impressionou meus clientes. Parece uma empresa grande, mas sou só eu. O sistema é lindo e muito fácil de usar.',
    avatar: 'FL',
    saved: 'Lucro aumentou 38%',
  },
  {
    name: 'Juliana Souza',
    role: 'Cosméticos naturais',
    text: 'O dashboard me mostra tudo de manhã cedo. Faturamento, pedidos, estoque. Não fico mais perdida nos grupos do WhatsApp.',
    avatar: 'JS',
    saved: '3h por semana economizadas',
  },
]

/* ─── How it works ─── */
const steps = [
  {
    step: '01',
    title: 'Crie sua conta grátis',
    desc: 'Cadastre-se em menos de 2 minutos. Sem cartão, sem complicação. 7 dias grátis para explorar tudo.',
    icon: '🚀',
  },
  {
    step: '02',
    title: 'Configure seu negócio',
    desc: 'Adicione seus produtos, materiais e custos fixos. O sistema calcula tudo automaticamente.',
    icon: '⚙️',
  },
  {
    step: '03',
    title: 'Gerencie com clareza',
    desc: 'Acompanhe pedidos, gere orçamentos em PDF e veja seu financeiro em tempo real no dashboard.',
    icon: '📊',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAF7F4] dark:bg-[#1C1714]">

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-[#FAF7F4]/80 dark:bg-[#1C1714]/80 backdrop-blur-xl border-b border-[#EDE8E2] dark:border-[#3A3028]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)' }}>
              <span className="text-white font-bold text-sm">P+</span>
            </div>
            <span className="font-bold text-lg text-[#2C2018] dark:text-stone-100">
              Precy<span style={{ color: '#8B6C4F' }}>+</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm">
            {[
              { href: '#funcionalidades', label: 'Funcionalidades' },
              { href: '#preview', label: 'Preview' },
              { href: '#planos', label: 'Planos' },
              { href: '#depoimentos', label: 'Depoimentos' },
            ].map(l => (
              <a key={l.label} href={l.href}
                className="text-[#7A6855] dark:text-stone-400 hover:text-[#8B6C4F] transition-colors">
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <Link href="/login"
              className="text-sm font-medium text-[#7A6855] dark:text-stone-400 hover:text-[#8B6C4F] px-3 py-2 rounded-xl hover:bg-[rgba(139,108,79,0.06)] transition-all">
              Entrar
            </Link>
            <Link href="/cadastro"
              className="text-sm font-semibold text-white px-4 py-2 rounded-xl transition-all"
              style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)', boxShadow: '0 2px 12px rgba(139,108,79,0.3)' }}>
              Criar conta grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-10 sm:pt-16 pb-16 sm:pb-20 px-4 sm:px-6">
        {/* Gradient bg blob */}
        <div aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full opacity-[0.07] blur-3xl"
          style={{ background: 'radial-gradient(ellipse, #8B6C4F 0%, transparent 70%)' }}
        />
        {/* Dots pattern */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'radial-gradient(circle, #8B6C4F 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Left — copy */}
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 border border-[#EDE8E2] dark:border-[#3A3028] bg-white dark:bg-[#2A2220] text-[#8B6C4F] text-xs font-semibold px-4 py-2 rounded-full mb-7 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#5C8B4F] animate-pulse" />
                🎉 7 dias grátis — Sem cartão de crédito
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold text-[#2C2018] dark:text-stone-100 leading-[1.15] mb-5">
                Chega de perder{' '}
                <span style={{
                  background: 'linear-gradient(135deg, #8B6C4F, #B8956A)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  dinheiro
                </span>
                {' '}com preço errado
              </h1>

              <p className="text-lg text-[#7A6855] dark:text-stone-400 mb-8 leading-relaxed max-w-lg">
                O Precy+ calcula o preço ideal, organiza pedidos no Kanban, controla estoque
                e gera orçamentos profissionais em PDF — tudo num sistema elegante e fácil de usar.
              </p>

              {/* Targets */}
              <div className="flex flex-wrap gap-2 mb-8">
                {['🎨 Gráficas', '✉️ Papelaria', '🕯️ Velas', '💄 Cosméticos', '🎀 Personalizados', '🧵 Artesãs'].map(tag => (
                  <span key={tag}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-[#EDE8E2] dark:border-[#3A3028] bg-white dark:bg-[#2A2220] text-[#7A6855] dark:text-stone-400">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/cadastro"
                  className="text-sm font-semibold text-white py-3.5 px-7 rounded-xl transition-all text-center"
                  style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)', boxShadow: '0 4px 20px rgba(139,108,79,0.3)' }}>
                  ✨ Criar conta grátis — 7 dias
                </Link>
                <Link href="/login"
                  className="text-sm font-semibold text-[#8B6C4F] py-3.5 px-7 rounded-xl border-2 border-[#8B6C4F] hover:bg-[rgba(139,108,79,0.06)] transition-all text-center">
                  Já tenho conta
                </Link>
              </div>

              {/* Trust */}
              <div className="flex items-center gap-4 mt-8">
                <div className="flex -space-x-2">
                  {['AC','FL','JS','MR','PT'].map((i, idx) => (
                    <div key={i}
                      className="w-8 h-8 rounded-full border-2 border-white dark:border-[#1C1714] flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: ['#8B6C4F','#B8956A','#5C8B4F','#3A7EC4','#C4893A'][idx], zIndex: 5 - idx }}>
                      {i}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex gap-0.5 mb-0.5">
                    {[1,2,3,4,5].map(i => <span key={i} className="text-[#C4893A] text-xs">★</span>)}
                  </div>
                  <p className="text-xs text-[#7A6855] dark:text-stone-400">
                    <strong className="text-[#2C2018] dark:text-stone-200">+200 empreendedoras</strong> confiam no Precy+
                  </p>
                </div>
              </div>
            </div>

            {/* Right — dashboard animado */}
            <div className="lg:pl-4">
              <HeroDashboard />
            </div>
          </div>
        </div>
      </section>

      {/* ── BENEFITS STRIP ── */}
      <section className="py-10 px-4 sm:px-6 border-y border-[#EDE8E2] dark:border-[#3A3028]"
        style={{ background: 'rgba(139,108,79,0.03)' }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 text-center">
          {[
            { icon: '⚡', text: 'Configure em 5 minutos' },
            { icon: '📱', text: 'Mobile e desktop' },
            { icon: '🔒', text: 'Dados criptografados' },
            { icon: '🌙', text: 'Dark mode elegante' },
            { icon: '♾️', text: 'Atualizações grátis' },
            { icon: '💬', text: 'Suporte em PT-BR' },
          ].map(b => (
            <div key={b.text} className="flex flex-col items-center gap-2">
              <span className="text-2xl">{b.icon}</span>
              <p className="text-xs font-medium text-[#7A6855] dark:text-stone-400">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── APP CALLOUT ── */}
      <AppCalloutSection />

      {/* ── PAIN SECTION ── */}
      <PainSection />

      {/* ── STATS ── */}
      <StatsSection />

      {/* ── FEATURES ── */}
      <section id="funcionalidades" className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 bg-[rgba(139,108,79,0.1)] text-[#8B6C4F] text-xs font-semibold px-4 py-2 rounded-full mb-4">
              ✨ Funcionalidades
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#2C2018] dark:text-stone-100 mb-4">
              Tudo que o seu negócio precisa
            </h2>
            <p className="text-[#7A6855] dark:text-stone-400 max-w-xl mx-auto">
              Do cálculo de preço ao orçamento profissional — o Precy+ reúne tudo para você crescer com organização.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(f => (
              <div key={f.title}
                className="group rounded-2xl border border-[#EDE8E2] dark:border-[#3A3028] bg-white dark:bg-[#2A2220] p-6 hover:border-[#8B6C4F] hover:shadow-[0_4px_24px_rgba(139,108,79,0.12)] transition-all duration-300 cursor-default">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform duration-300"
                  style={{ background: 'rgba(139,108,79,0.08)' }}>
                  {f.icon}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-base font-semibold text-[#2C2018] dark:text-stone-100">{f.title}</h3>
                  {f.badge && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                      style={{ background: f.badge.color }}>
                      {f.badge.label}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#7A6855] dark:text-stone-400 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE PREVIEW ── */}
      <div id="preview">
        <LivePreview />
      </div>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 px-4 sm:px-6"
        style={{ background: 'rgba(139,108,79,0.03)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 bg-[rgba(139,108,79,0.1)] text-[#8B6C4F] text-xs font-semibold px-4 py-2 rounded-full mb-4">
              🗺️ Como funciona
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#2C2018] dark:text-stone-100 mb-4">
              Simples assim — em 3 passos
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative">
            {/* Linha conectora */}
            <div className="hidden md:block absolute top-10 left-1/3 right-1/3 h-0.5"
              style={{ background: 'linear-gradient(90deg, rgba(139,108,79,0.2), rgba(139,108,79,0.5), rgba(139,108,79,0.2))' }} />
            {steps.map((item, i) => (
              <div key={item.step} className="relative text-center">
                <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center mx-auto mb-4 shadow-md relative"
                  style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)', boxShadow: '0 4px 20px rgba(139,108,79,0.25)' }}>
                  <span className="text-2xl">{item.icon}</span>
                </div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-5 h-5 rounded-full bg-white dark:bg-[#1C1714] border-2 border-[#8B6C4F] flex items-center justify-center text-[9px] font-bold text-[#8B6C4F]">
                  {i + 1}
                </div>
                <h3 className="text-base font-semibold text-[#2C2018] dark:text-stone-100 mb-2">{item.title}</h3>
                <p className="text-sm text-[#7A6855] dark:text-stone-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="depoimentos" className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 bg-[rgba(139,108,79,0.1)] text-[#8B6C4F] text-xs font-semibold px-4 py-2 rounded-full mb-4">
              💬 Depoimentos
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#2C2018] dark:text-stone-100 mb-4">
              Quem usa, aprova
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testimonials.map(t => (
              <div key={t.name}
                className="rounded-2xl border border-[#EDE8E2] dark:border-[#3A3028] bg-white dark:bg-[#2A2220] p-6 space-y-4 hover:border-[#8B6C4F] hover:shadow-[0_4px_24px_rgba(139,108,79,0.1)] transition-all duration-300">
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className="text-[#C4893A] text-sm">★</span>
                  ))}
                </div>
                <p className="text-sm text-[#7A6855] dark:text-stone-400 leading-relaxed italic">
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-[#EDE8E2] dark:border-[#3A3028]">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(139,108,79,0.1)' }}>
                    <span className="text-[#8B6C4F] font-semibold text-sm">{t.avatar}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#2C2018] dark:text-stone-100">{t.name}</p>
                    <p className="text-xs text-[#B8A898]">{t.role}</p>
                  </div>
                  <span className="ml-auto text-[10px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(92,139,79,0.12)', color: '#5C8B4F' }}>
                    {t.saved}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANS ── */}
      <PlansSection />

      {/* ── FINAL CTA ── */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="rounded-3xl p-10 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #8B6C4F 0%, #B8956A 50%, #C4A47B 100%)' }}>
            {/* decorativo */}
            <div aria-hidden className="absolute top-0 left-0 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ background: 'rgba(255,255,255,0.4)', transform: 'translate(-30%, -30%)' }} />
            <div aria-hidden className="absolute bottom-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ background: 'rgba(255,255,255,0.4)', transform: 'translate(30%, 30%)' }} />

            <div className="relative">
              <div className="text-5xl mb-5">🚀</div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Pronta para precificar com confiança?
              </h2>
              <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
                Junte-se a centenas de empreendedoras que já usam o Precy+ para crescer
                com organização, clareza e resultados reais.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/cadastro"
                  className="bg-white text-[#8B6C4F] font-semibold py-3.5 px-8 rounded-xl hover:bg-[#FAF7F4] active:scale-[0.98] transition-all shadow-lg w-full sm:w-auto">
                  ✨ Criar conta grátis — 7 dias
                </Link>
                <Link href="/login"
                  className="bg-white/10 text-white font-medium py-3.5 px-8 rounded-xl hover:bg-white/20 transition-all border border-white/20 w-full sm:w-auto">
                  Já tenho conta
                </Link>
              </div>
              <p className="text-white/50 text-xs mt-5">Sem cartão · Cancele quando quiser · Pagamento via Stripe</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#EDE8E2] dark:border-[#3A3028] py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)' }}>
                  <span className="text-white font-bold text-sm">P+</span>
                </div>
                <span className="font-bold text-lg text-[#2C2018] dark:text-stone-100">
                  Precy<span style={{ color: '#8B6C4F' }}>+</span>
                </span>
              </div>
              <p className="text-sm text-[#7A6855] dark:text-stone-400 leading-relaxed max-w-xs">
                O sistema de precificação e gestão feito especialmente para artesãs,
                papelaria, cosméticos e pequenos negócios criativos.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#2C2018] dark:text-stone-100 mb-3">Sistema</h4>
              <ul className="space-y-2">
                {[
                  { href: '/cadastro', label: 'Criar conta' },
                  { href: '/login', label: 'Entrar' },
                  { href: '#planos', label: 'Planos' },
                  { href: '#funcionalidades', label: 'Funcionalidades' },
                ].map(l => (
                  <li key={l.label}>
                    <Link href={l.href}
                      className="text-sm text-[#7A6855] dark:text-stone-400 hover:text-[#8B6C4F] transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#2C2018] dark:text-stone-100 mb-3">Legal</h4>
              <ul className="space-y-2">
                <li><Link href="/termos" className="text-sm text-[#7A6855] dark:text-stone-400 hover:text-[#8B6C4F] transition-colors">Termos de Uso</Link></li>
                <li><Link href="/privacidade" className="text-sm text-[#7A6855] dark:text-stone-400 hover:text-[#8B6C4F] transition-colors">Política de Privacidade</Link></li>
                <li><Link href="/cancelamento" className="text-sm text-[#7A6855] dark:text-stone-400 hover:text-[#8B6C4F] transition-colors">Política de Cancelamento</Link></li>
                <li><Link href="/suporte" className="text-sm text-[#7A6855] dark:text-stone-400 hover:text-[#8B6C4F] transition-colors">Suporte</Link></li>
                <li><a href="mailto:suporte@precyplus.com.br" className="text-sm text-[#7A6855] dark:text-stone-400 hover:text-[#8B6C4F] transition-colors">Contato</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-[#EDE8E2] dark:border-[#3A3028] flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-[#B8A898]">
              © {new Date().getFullYear()} Precy+ Sistemas. Todos os direitos reservados.
            </p>
            <p className="text-xs text-[#B8A898]">
              Feito com ❤️ para pequenos negócios brasileiros
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}
