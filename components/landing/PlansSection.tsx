'use client'
import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'

export function PlansSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const features = [
    { label: 'Dashboard com dados reais', basic: true, pro: true },
    { label: 'Precificação inteligente', basic: true, pro: true },
    { label: 'Estoque com alertas', basic: true, pro: true },
    { label: 'Kanban de pedidos', basic: true, pro: true },
    { label: 'Orçamentos em PDF', basic: true, pro: true },
    { label: 'Financeiro completo', basic: true, pro: true },
    { label: 'Número de produtos', basic: 'Até 20', pro: 'Ilimitado' },
    { label: 'Pedidos por mês', basic: 'Até 30', pro: 'Ilimitado' },
    { label: 'Relatórios avançados', basic: false, pro: true },
    { label: 'Sem marca d\'água no PDF', basic: false, pro: true },
    { label: 'Suporte prioritário', basic: false, pro: true },
    { label: 'IA de precificação', basic: false, pro: 'Em breve' },
    { label: 'WhatsApp integrado', basic: false, pro: 'Em breve' },
  ]

  return (
    <section id="planos" ref={ref} className="py-24 px-4 sm:px-6 bg-[#FAF7F4] dark:bg-[rgba(255,255,255,0.02)]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-2 bg-[rgba(139,108,79,0.1)] text-[#8B6C4F] text-xs font-semibold px-4 py-2 rounded-full mb-4">
            💳 Planos e preços
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#2C2018] dark:text-stone-100 mb-4">
            Comece grátis, cresça no seu ritmo
          </h2>
          <p className="text-[#7A6855] dark:text-stone-400 max-w-xl mx-auto">
            7 dias grátis em qualquer plano. Sem cartão. Cancele quando quiser.
          </p>
        </div>

        {/* Cards dos planos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Basic */}
          <div
            className="rounded-2xl border border-[#EDE8E2] dark:border-[#3A3028] bg-white dark:bg-[#2A2220] p-7 relative"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.5s ease',
            }}
          >
            <div className="mb-5">
              <span className="inline-flex items-center gap-1.5 bg-[rgba(92,139,79,0.1)] text-[#5C8B4F] text-xs font-bold px-3 py-1 rounded-full mb-3">
                🌱 7 dias grátis para testar
              </span>
              <h3 className="text-xl font-bold text-[#2C2018] dark:text-stone-100 mb-1">Basic</h3>
              <p className="text-sm text-[#7A6855] dark:text-stone-400">Para quem está começando a organizar o negócio</p>
            </div>
            <div className="flex items-end gap-1 mb-6">
              <span className="text-4xl font-bold text-[#2C2018] dark:text-stone-100">R$ 17</span>
              <span className="text-[#B8A898] mb-1.5">/mês</span>
            </div>
            <Link href="/cadastro" className="block w-full text-center py-3 px-6 rounded-xl font-semibold text-sm border-2 border-[#8B6C4F] text-[#8B6C4F] hover:bg-[#8B6C4F] hover:text-white transition-all duration-200 mb-6">
              Começar grátis por 7 dias
            </Link>
            <ul className="space-y-2.5">
              {['Dashboard com dados reais', 'Até 20 produtos', 'Até 30 pedidos/mês', 'Orçamentos com PDF', 'Estoque inteligente', 'Financeiro básico', 'Suporte por e-mail'].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-[#7A6855] dark:text-stone-400">
                  <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold bg-[rgba(92,139,79,0.15)] text-[#5C8B4F]">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div
            className="rounded-2xl border-2 border-[#8B6C4F] bg-white dark:bg-[#2A2220] p-7 relative overflow-hidden"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.5s ease 0.1s',
              boxShadow: '0 0 40px rgba(139,108,79,0.15)',
            }}
          >
            {/* Badge */}
            <div className="absolute top-5 right-5">
              <span className="bg-gradient-to-r from-[#8B6C4F] to-[#B8956A] text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                ⭐ Mais popular
              </span>
            </div>
            {/* Economia */}
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #8B6C4F, #B8956A, #C4A47B)' }} />

            <div className="mb-5">
              <span className="inline-flex items-center gap-1.5 bg-[rgba(139,108,79,0.1)] text-[#8B6C4F] text-xs font-bold px-3 py-1 rounded-full mb-3">
                🚀 7 dias grátis para testar
              </span>
              <h3 className="text-xl font-bold text-[#2C2018] dark:text-stone-100 mb-1">Pro</h3>
              <p className="text-sm text-[#7A6855] dark:text-stone-400">Para crescer sem limites</p>
            </div>

            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold text-[#2C2018] dark:text-stone-100">R$ 37</span>
              <span className="text-[#B8A898] mb-1.5">/mês</span>
            </div>
            <p className="text-xs text-[#5C8B4F] font-medium mb-6">= R$ 1,23/dia — menos que um café</p>

            <Link href="/cadastro" className="block w-full text-center py-3 px-6 rounded-xl font-semibold text-sm text-white transition-all duration-200 mb-6"
              style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)', boxShadow: '0 4px 20px rgba(139,108,79,0.3)' }}>
              Começar grátis por 7 dias →
            </Link>

            <ul className="space-y-2.5">
              {[
                'Tudo do Basic',
                'Produtos e pedidos ilimitados',
                'Relatórios avançados',
                'Sem marca d\'água nos PDFs',
                'Suporte prioritário',
                'IA de precificação (em breve)',
                'WhatsApp integrado (em breve)',
                'Agenda de entregas (em breve)',
              ].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-[#7A6855] dark:text-stone-400">
                  <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold bg-[rgba(139,108,79,0.15)] text-[#8B6C4F]">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Tabela comparativa */}
        <div
          className="rounded-2xl border border-[#EDE8E2] dark:border-[#3A3028] bg-white dark:bg-[#2A2220] overflow-hidden"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s ease 0.2s',
          }}
        >
          <div className="grid grid-cols-3 bg-[#FAF7F4] dark:bg-[rgba(255,255,255,0.03)] p-4 border-b border-[#EDE8E2] dark:border-[#3A3028]">
            <p className="text-xs font-semibold text-[#B8A898] uppercase tracking-wider">Funcionalidade</p>
            <p className="text-xs font-semibold text-center text-[#7A6855] dark:text-stone-400">Basic</p>
            <p className="text-xs font-semibold text-center" style={{ color: '#8B6C4F' }}>Pro</p>
          </div>
          {features.map((f, i) => (
            <div
              key={f.label}
              className="grid grid-cols-3 px-4 py-3 items-center border-b border-[#EDE8E2] dark:border-[#3A3028] last:border-0"
              style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(139,108,79,0.02)' }}
            >
              <span className="text-xs text-[#2C2018] dark:text-stone-200">{f.label}</span>
              <div className="text-center">
                {f.basic === true
                  ? <span className="text-[#5C8B4F] text-sm">✓</span>
                  : f.basic === false
                  ? <span className="text-[#EDE8E2] dark:text-[#3A3028] text-sm">—</span>
                  : <span className="text-[10px] text-[#7A6855] dark:text-stone-400 font-medium">{f.basic}</span>
                }
              </div>
              <div className="text-center">
                {f.pro === true
                  ? <span className="text-[#8B6C4F] font-bold text-sm">✓</span>
                  : f.pro === false
                  ? <span className="text-[#EDE8E2] dark:text-[#3A3028] text-sm">—</span>
                  : <span className="text-[10px] font-semibold" style={{ color: '#8B6C4F' }}>{f.pro}</span>
                }
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-[#B8A898] mt-6">
          Cancele quando quiser · Pagamento seguro via Stripe · Sem fidelidade
        </p>
      </div>
    </section>
  )
}
