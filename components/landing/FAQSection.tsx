'use client'
import { useRef, useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    q: 'Preciso colocar cartão de crédito para testar?',
    a: 'Não. Você cria a conta, usa o Precy+ por 7 dias completos e só decide se quer assinar depois de ver o sistema funcionando com o seu negócio.',
  },
  {
    q: 'O Precy+ funciona para o meu tipo de negócio?',
    a: 'Sim. O Precy+ foi desenhado para pequenos negócios que precificam produtos por material + mão de obra: papelaria personalizada, gráfica rápida, confeitaria, crochê, velas, artesanato em geral, costura, sublimação e brindes personalizados. Se você calcula preço de produto feito por encomenda, o Precy+ foi feito para você.',
  },
  {
    q: 'Preciso entender de sistema ou planilha para usar?',
    a: 'Não. A configuração inicial leva menos de 5 minutos e o sistema calcula tudo automaticamente a partir dos seus custos. Não é preciso saber fórmulas nem planilhas — só cadastrar seus materiais uma vez.',
  },
  {
    q: 'Qual a diferença entre o plano Basic e o Pro?',
    a: 'O Basic já inclui precificação, estoque, pedidos em Kanban, clientes, fornecedores e orçamentos em PDF — ideal para quem está começando. O Pro libera produtos e pedidos ilimitados, financeiro completo (fluxo de caixa, contas a pagar/receber, centros de custo) e a Biblioteca Precy+ com produtos prontos.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim, o cancelamento é feito em poucos cliques dentro do sistema, sem fidelidade e sem multa. Você continua com acesso até o fim do período já pago.',
  },
  {
    q: 'Meus dados e os dos meus clientes ficam seguros?',
    a: 'Sim. Os dados são armazenados de forma criptografada e o pagamento é processado pela Stripe — o Precy+ nunca tem acesso ao número do seu cartão.',
  },
  {
    q: 'O que acontece quando os 7 dias grátis terminam?',
    a: 'Você escolhe o plano Basic ou Pro para continuar usando. Se preferir não assinar, sua conta fica pausada — seus dados não são apagados, e você pode retomar quando quiser.',
  },
]

export function FAQSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState<number | null>(0)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="faq" ref={ref} className="py-24 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 bg-[rgba(139,108,79,0.1)] text-[#8B6C4F] text-xs font-semibold px-4 py-2 rounded-full mb-4">
            ❓ Perguntas frequentes
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#2C2018] dark:text-stone-100 mb-4">
            Ainda com dúvidas?
          </h2>
          <p className="text-[#7A6855] dark:text-stone-400 max-w-lg mx-auto">
            Separamos as perguntas mais comuns de quem está prestes a experimentar o Precy+.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((item, i) => {
            const isOpen = open === i
            return (
              <div
                key={item.q}
                className="rounded-2xl border border-[#EDE8E2] dark:border-[#3A3028] bg-white dark:bg-[#2A2220] overflow-hidden"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(16px)',
                  transition: `all 0.4s ease ${i * 0.05}s`,
                }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 text-left px-5 py-4"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-semibold text-[#2C2018] dark:text-stone-100">
                    {item.q}
                  </span>
                  <ChevronDown
                    size={18}
                    className="flex-shrink-0 text-[#8B6C4F] transition-transform duration-300"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>
                <div
                  className="grid transition-all duration-300 ease-in-out"
                  style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 text-sm text-[#7A6855] dark:text-stone-400 leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-center text-sm text-[#7A6855] dark:text-stone-400 mt-8">
          Ainda tem dúvidas?{' '}
          <a href="mailto:suporte@precyplus.com.br" className="font-semibold underline" style={{ color: '#8B6C4F' }}>
            Fale com a gente
          </a>
        </p>
      </div>
    </section>
  )
}
