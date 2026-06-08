import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Precy+ Sistemas — Precificação e Gestão para Pequenos Negócios',
  description:
    'SaaS premium de precificação inteligente, estoque, pedidos, orçamentos em PDF e financeiro para artesãs, papelaria, cosméticos e pequenos negócios.',
}

/* ─── Dados estáticos ─── */
const features = [
  {
    icon: '💰',
    title: 'Precificação Inteligente',
    description:
      'Calcule o preço ideal com base em materiais, mão de obra e custos fixos. Gere cenários automaticamente.',
  },
  {
    icon: '📦',
    title: 'Estoque Inteligente',
    description:
      'Controle materiais com alertas de estoque crítico, mínimo e saudável. Nunca fique sem insumos.',
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
      'Gere orçamentos profissionais com PDF premium, logo da sua empresa e todos os itens calculados.',
  },
  {
    icon: '💵',
    title: 'Financeiro Completo',
    description:
      'Registre receitas e despesas, visualize saldo em tempo real e acompanhe a saúde do negócio.',
  },
  {
    icon: '📊',
    title: 'Dashboard com Dados Reais',
    description:
      'Veja faturamento, lucro, pedidos ativos e alertas em cards e gráficos atualizados automaticamente.',
  },
]

const benefits = [
  { icon: '⚡', text: 'Configure em menos de 5 minutos' },
  { icon: '📱', text: 'Funciona no celular e computador' },
  { icon: '🔒', text: 'Seus dados protegidos com criptografia' },
  { icon: '🌙', text: 'Dark mode elegante incluído' },
  { icon: '♾️', text: 'Atualizações gratuitas sempre' },
  { icon: '💬', text: 'Suporte em português brasileiro' },
]

const plans = [
  {
    name: 'Basic',
    badge: 'Grátis por 7 dias',
    price: 'Grátis',
    period: '7 dias de trial',
    description: 'Perfeito para começar e conhecer o sistema.',
    cta: 'Começar grátis',
    ctaHref: '/cadastro',
    highlight: false,
    features: [
      'Dashboard com dados reais',
      'Até 20 produtos',
      'Gestão de pedidos',
      'Orçamentos com PDF',
      'Estoque inteligente',
      'Financeiro básico',
      'Suporte por e-mail',
    ],
  },
  {
    name: 'Pro',
    badge: 'Mais popular',
    price: 'R$ 49',
    period: '/mês',
    description: 'Para quem quer crescer sem limites.',
    cta: 'Assinar Pro',
    ctaHref: '/cadastro',
    highlight: true,
    features: [
      'Tudo do Basic',
      'Produtos e pedidos ilimitados',
      'IA de precificação (em breve)',
      'WhatsApp integrado (em breve)',
      'Relatórios avançados',
      'Sem marca d\'água nos PDFs',
      'Suporte prioritário',
      'Agenda de entregas (em breve)',
    ],
  },
]

const testimonials = [
  {
    name: 'Ana Clara',
    role: 'Artesã — Papelaria personalizada',
    text: 'Antes eu chutava o preço e ficava no prejuízo. Com o Precy+ eu finalmente sei o que cobrar e ainda organizo todos os meus pedidos num só lugar.',
    avatar: 'AC',
  },
  {
    name: 'Fernanda Lima',
    role: 'Empreendedora — Velas artesanais',
    text: 'O orçamento em PDF impressionou meus clientes. Parece uma empresa grande, mas sou só eu. O sistema é lindo e muito fácil de usar.',
    avatar: 'FL',
  },
  {
    name: 'Juliana Souza',
    role: 'Cosmetóloga — Cosméticos naturais',
    text: 'O dashboard me mostra tudo que preciso de manhã cedo. Faturamento, pedidos, estoque. Não fico mais perdida nos grupos do Whatsapp.',
    avatar: 'JS',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background dark:bg-background-dark">

      {/* ══════════════════════════════
          NAVBAR
      ══════════════════════════════ */}
      <nav className="sticky top-0 z-50 bg-background/80 dark:bg-background-dark/80 backdrop-blur-xl border-b border-border dark:border-border-dark">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">P+</span>
            </div>
            <span className="font-bold text-lg text-text-primary dark:text-stone-100">
              Precy<span className="text-primary">+</span>
            </span>
          </Link>

          {/* Links */}
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href="#funcionalidades" className="text-text-secondary dark:text-stone-400 hover:text-primary transition-colors">
              Funcionalidades
            </a>
            <a href="#planos" className="text-text-secondary dark:text-stone-400 hover:text-primary transition-colors">
              Planos
            </a>
            <a href="#depoimentos" className="text-text-secondary dark:text-stone-400 hover:text-primary transition-colors">
              Depoimentos
            </a>
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="text-sm font-medium text-text-secondary dark:text-stone-400 hover:text-primary px-3 py-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 transition-all"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="btn-primary text-sm py-2 px-4"
            >
              Criar conta grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════
          HERO
      ══════════════════════════════ */}
      <section className="relative overflow-hidden pt-20 pb-24 px-4 sm:px-6">
        {/* Gradient blur bg */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(ellipse, #8B6C4F 0%, transparent 70%)' }}
        />

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary-50 dark:bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-4 py-2 rounded-full mb-8">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            🎉 Trial de 7 dias grátis — Sem cartão de crédito
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary dark:text-stone-100 leading-tight mb-6">
            Precificação e gestão{' '}
            <span className="gradient-text">inteligente</span>
            <br className="hidden sm:block" />
            {' '}para o seu negócio
          </h1>

          <p className="text-lg sm:text-xl text-text-secondary dark:text-stone-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Chega de perder dinheiro chutando preço. O Precy+ calcula o preço ideal,
            organiza seus pedidos no Kanban, controla estoque e gera orçamentos
            profissionais em PDF — tudo num sistema elegante e fácil de usar.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
            <Link
              href="/cadastro"
              className="btn-primary text-base py-3.5 px-8 w-full sm:w-auto"
            >
              ✨ Criar conta grátis
            </Link>
            <Link
              href="/login"
              className="btn-secondary text-base py-3.5 px-8 w-full sm:w-auto"
            >
              Já tenho conta
            </Link>
          </div>

          {/* Hero visual — mockup do dashboard */}
          <div className="relative mx-auto max-w-3xl">
            <div className="rounded-2xl border border-border dark:border-border-dark shadow-modal overflow-hidden bg-white dark:bg-surface-dark">
              {/* Barra de navegação fake */}
              <div className="bg-primary px-6 py-4 flex items-center gap-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-white/30" />
                  <div className="w-3 h-3 rounded-full bg-white/30" />
                  <div className="w-3 h-3 rounded-full bg-white/30" />
                </div>
                <div className="flex-1 bg-white/10 rounded-lg h-6" />
              </div>
              {/* Cards simulados */}
              <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Faturamento', value: 'R$ 4.820', color: 'text-success' },
                  { label: 'Lucro', value: 'R$ 2.310', color: 'text-success' },
                  { label: 'Pedidos', value: '14', color: 'text-info' },
                  { label: 'Estoque OK', value: '✓', color: 'text-success' },
                ].map(card => (
                  <div key={card.label} className="bg-background dark:bg-background-dark rounded-xl p-4 border border-border dark:border-border-dark">
                    <p className="text-xs text-text-muted mb-2">{card.label}</p>
                    <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                  </div>
                ))}
              </div>
              {/* Gráfico fake */}
              <div className="px-6 pb-6">
                <div className="rounded-xl bg-background dark:bg-background-dark border border-border dark:border-border-dark p-4">
                  <div className="flex items-end gap-2 h-24">
                    {[40, 65, 45, 80, 60, 90, 75, 88, 70, 95, 82, 100].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm"
                        style={{
                          height: `${h}%`,
                          background: i === 11
                            ? 'linear-gradient(180deg, #8B6C4F, #B8956A)'
                            : 'rgba(139,108,79,0.15)',
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-text-muted mt-2 text-center">Receita — últimos 12 meses</p>
                </div>
              </div>
            </div>
            {/* Glow */}
            <div
              aria-hidden
              className="absolute -inset-4 rounded-3xl opacity-30 blur-2xl -z-10"
              style={{ background: 'radial-gradient(ellipse, #8B6C4F 0%, transparent 70%)' }}
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          BENEFÍCIOS RÁPIDOS
      ══════════════════════════════ */}
      <section className="py-12 px-4 sm:px-6 border-y border-border dark:border-border-dark bg-primary-50/50 dark:bg-primary/5">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 text-center">
          {benefits.map(b => (
            <div key={b.text} className="flex flex-col items-center gap-2">
              <span className="text-2xl">{b.icon}</span>
              <p className="text-xs font-medium text-text-secondary dark:text-stone-400">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          FUNCIONALIDADES
      ══════════════════════════════ */}
      <section id="funcionalidades" className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="badge badge-primary mb-4">Funcionalidades</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary dark:text-stone-100 mb-4">
              Tudo que o seu negócio precisa
            </h2>
            <p className="text-text-secondary dark:text-stone-400 max-w-xl mx-auto">
              Do cálculo de preço ao orçamento profissional, o Precy+ reúne todas as
              ferramentas que você precisa para crescer com organização.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(f => (
              <div
                key={f.title}
                className="card card-hover group"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold text-text-primary dark:text-stone-100 mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-text-secondary dark:text-stone-400 leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          COMO FUNCIONA
      ══════════════════════════════ */}
      <section className="py-24 px-4 sm:px-6 bg-primary-50/50 dark:bg-primary/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="badge badge-primary mb-4">Como funciona</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary dark:text-stone-100 mb-4">
              Simples assim
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Crie sua conta',
                desc: 'Cadastre-se em menos de 2 minutos. Sem cartão, sem complicação. 7 dias grátis para explorar tudo.',
              },
              {
                step: '02',
                title: 'Configure seu negócio',
                desc: 'Adicione seus produtos, materiais e custos fixos. O sistema calcula tudo automaticamente.',
              },
              {
                step: '03',
                title: 'Gerencie com clareza',
                desc: 'Acompanhe pedidos, gere orçamentos em PDF e veja seu financeiro em tempo real no dashboard.',
              },
            ].map(item => (
              <div key={item.step} className="relative text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center text-white font-bold text-lg mx-auto mb-4 shadow-btn">
                  {item.step}
                </div>
                <h3 className="text-base font-semibold text-text-primary dark:text-stone-100 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-text-secondary dark:text-stone-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          DEPOIMENTOS
      ══════════════════════════════ */}
      <section id="depoimentos" className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="badge badge-primary mb-4">Depoimentos</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary dark:text-stone-100 mb-4">
              Quem usa, aprova
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map(t => (
              <div key={t.name} className="card space-y-4">
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className="text-warning text-sm">★</span>
                  ))}
                </div>
                <p className="text-sm text-text-secondary dark:text-stone-400 leading-relaxed italic">
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-border dark:border-border-dark">
                  <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-semibold text-sm">{t.avatar}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary dark:text-stone-100">{t.name}</p>
                    <p className="text-xs text-text-muted">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          PLANOS
      ══════════════════════════════ */}
      <section id="planos" className="py-24 px-4 sm:px-6 bg-primary-50/50 dark:bg-primary/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="badge badge-primary mb-4">Planos</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary dark:text-stone-100 mb-4">
              Preço justo, resultado real
            </h2>
            <p className="text-text-secondary dark:text-stone-400">
              Comece grátis por 7 dias. Sem cartão de crédito.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plans.map(plan => (
              <div
                key={plan.name}
                className={`card relative ${plan.highlight ? 'border-2 border-primary ring-4 ring-primary/10' : ''}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-primary text-white text-xs font-bold px-4 py-1 rounded-full shadow-btn">
                      {plan.badge}
                    </span>
                  </div>
                )}
                {!plan.highlight && (
                  <span className="badge badge-success mb-3 inline-block">{plan.badge}</span>
                )}

                <div className="mb-5">
                  <h3 className="text-xl font-bold text-text-primary dark:text-stone-100 mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-text-secondary dark:text-stone-400">{plan.description}</p>
                </div>

                <div className="flex items-end gap-1 mb-6">
                  <span className="text-4xl font-bold text-text-primary dark:text-stone-100">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-text-muted mb-1">{plan.period}</span>
                  )}
                </div>

                <Link
                  href={plan.ctaHref}
                  className={`block text-center py-3 px-6 rounded-xl font-medium text-sm transition-all mb-6 ${
                    plan.highlight
                      ? 'btn-primary'
                      : 'btn-secondary'
                  }`}
                >
                  {plan.cta}
                </Link>

                <ul className="space-y-2.5">
                  {plan.features.map(feat => (
                    <li key={feat} className="flex items-center gap-2.5 text-sm text-text-secondary dark:text-stone-400">
                      <span className="text-success text-base leading-none flex-shrink-0">✓</span>
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-text-muted dark:text-stone-500 mt-8">
            Cancele quando quiser · Pagamento seguro via Stripe · Sem fidelidade
          </p>
        </div>
      </section>

      {/* ══════════════════════════════
          CTA FINAL
      ══════════════════════════════ */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="card bg-gradient-primary text-white">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-3xl mx-auto mb-6">
              🚀
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Pronta para precificar com confiança?
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
              Junte-se a centenas de empreendedoras que já usam o Precy+ para crescer
              com organização, clareza e resultados reais.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/cadastro"
                className="bg-white text-primary font-semibold py-3.5 px-8 rounded-xl hover:bg-primary-50 active:scale-[0.98] transition-all shadow-btn w-full sm:w-auto"
              >
                ✨ Criar conta grátis — 7 dias
              </Link>
              <Link
                href="/login"
                className="bg-white/10 text-white font-medium py-3.5 px-8 rounded-xl hover:bg-white/20 transition-all w-full sm:w-auto border border-white/20"
              >
                Já tenho conta
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          FOOTER
      ══════════════════════════════ */}
      <footer className="border-t border-border dark:border-border-dark py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-sm">P+</span>
                </div>
                <span className="font-bold text-lg text-text-primary dark:text-stone-100">
                  Precy<span className="text-primary">+</span>
                </span>
              </div>
              <p className="text-sm text-text-secondary dark:text-stone-400 leading-relaxed max-w-xs">
                O sistema de precificação e gestão feito especialmente para artesãs,
                papelaria, cosméticos e pequenos negócios criativos.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-3">Sistema</h4>
              <ul className="space-y-2">
                {[
                  { href: '/cadastro', label: 'Criar conta' },
                  { href: '/login', label: 'Entrar' },
                  { href: '#planos', label: 'Planos' },
                  { href: '#funcionalidades', label: 'Funcionalidades' },
                ].map(l => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-text-secondary dark:text-stone-400 hover:text-primary transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-3">Legal</h4>
              <ul className="space-y-2">
                {[
                  { href: '/termos', label: 'Termos de uso' },
                  { href: '/privacidade', label: 'Privacidade' },
                ].map(l => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-text-secondary dark:text-stone-400 hover:text-primary transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-border dark:border-border-dark flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-text-muted dark:text-stone-500">
              © {new Date().getFullYear()} Precy+ Sistemas. Todos os direitos reservados.
            </p>
            <p className="text-xs text-text-muted dark:text-stone-500">
              Feito com ❤️ para pequenos negócios brasileiros
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}
