'use client'
import { useRef, useState, useEffect } from 'react'

const pains = [
  {
    icon: '😰',
    before: 'Chutando o preço no WhatsApp',
    after: 'Preço ideal calculado em segundos',
    beforeDetail: 'Você responde "fica em torno de R$80" sem saber se está no prejuízo',
    afterDetail: 'O sistema calcula material + mão de obra + lucro automaticamente',
  },
  {
    icon: '📝',
    before: 'Pedidos anotados no caderno',
    after: 'Kanban organizado e visual',
    beforeDetail: 'Você esquece pedidos, entrega atrasado e perde cliente',
    afterDetail: 'Todos os pedidos organizados por status, com alerta de prazo',
  },
  {
    icon: '📊',
    before: 'Não sabe se está lucrando',
    after: 'Dashboard com lucro em tempo real',
    beforeDetail: 'Você trabalha muito mas não sabe se o mês fechou no positivo',
    afterDetail: 'Veja faturamento, lucro e despesas num único painel atualizado',
  },
  {
    icon: '📄',
    before: 'Orçamento por mensagem de texto',
    after: 'PDF profissional em 1 clique',
    beforeDetail: 'O cliente não leva a sério, pede desconto e abandona',
    afterDetail: 'Orçamento com logo, itens, valor e prazo — parecendo empresa grande',
  },
]

export function PainSection() {
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

  return (
    <section ref={ref} className="py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-2 bg-[rgba(196,80,58,0.1)] text-[#C4503A] text-xs font-semibold px-4 py-2 rounded-full mb-4">
            😣 A realidade de quem não usa o Precy+
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#2C2018] dark:text-stone-100 mb-4">
            Você reconhece algum desses problemas?
          </h2>
          <p className="text-[#7A6855] dark:text-stone-400 max-w-2xl mx-auto">
            A maioria das empreendedoras perde dinheiro todo mês sem perceber. Veja o que muda com o Precy+.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {pains.map((item, i) => (
            <div
              key={item.before}
              className="rounded-2xl border border-[#EDE8E2] dark:border-[#3A3028] overflow-hidden bg-white dark:bg-[#2A2220]"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(24px)',
                transition: `all 0.5s ease ${i * 0.1}s`,
              }}
            >
              {/* Topo: antes */}
              <div className="p-5 border-b border-[#EDE8E2] dark:border-[#3A3028]" style={{ background: 'rgba(196,80,58,0.04)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[rgba(196,80,58,0.1)] flex items-center justify-center text-xl flex-shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-[#C4503A] uppercase tracking-wider bg-[rgba(196,80,58,0.1)] px-2 py-0.5 rounded-full">Sem Precy+</span>
                    </div>
                    <p className="text-sm font-semibold text-[#C4503A]">{item.before}</p>
                    <p className="text-xs text-[#7A6855] dark:text-stone-400 mt-1">{item.beforeDetail}</p>
                  </div>
                </div>
              </div>
              {/* Base: depois */}
              <div className="p-5" style={{ background: 'rgba(92,139,79,0.04)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[rgba(92,139,79,0.1)] flex items-center justify-center text-xl flex-shrink-0">
                    ✅
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-[#5C8B4F] uppercase tracking-wider bg-[rgba(92,139,79,0.1)] px-2 py-0.5 rounded-full">Com Precy+</span>
                    </div>
                    <p className="text-sm font-semibold text-[#5C8B4F]">{item.after}</p>
                    <p className="text-xs text-[#7A6855] dark:text-stone-400 mt-1">{item.afterDetail}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
