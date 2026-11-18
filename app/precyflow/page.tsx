import Link from 'next/link'
import { Package, ShoppingCart, DollarSign, Store, Users, FileText } from 'lucide-react'
import { ThemeRoot } from '@/components/precyflow/ThemeRoot'
import { Logo } from '@/components/precyflow/Logo'
import { Mascot } from '@/components/precyflow/Mascot'

const FEATURES = [
  { icon: Package, title: 'Catálogo e materiais', desc: 'Organize produtos e insumos num só lugar, sem planilha.' },
  { icon: ShoppingCart, title: 'Pedidos em Kanban', desc: 'Acompanhe cada pedido de "a confirmar" até "entregue".' },
  { icon: FileText, title: 'Orçamentos em PDF', desc: 'Envie orçamentos com fotos, total e validade em poucos cliques.' },
  { icon: DollarSign, title: 'Financeiro simples', desc: 'Entradas, saídas e o que falta receber — sem confusão.' },
  { icon: Users, title: 'Clientes e agenda', desc: 'Histórico de cada cliente e os compromissos da semana.' },
  { icon: Store, title: 'Vitrine online', desc: 'Uma loja pública para seus clientes pedirem direto com você.' },
]

export default function PrecyFlowLandingPage() {
  return (
    <ThemeRoot>
      <div className="min-h-screen">
        <header className="flex items-center justify-between px-5 py-5 lg:px-12">
          <div className="flex items-center gap-2">
            <Mascot size={36} />
            <Logo subtitle={false} />
          </div>
          <div className="flex items-center gap-3">
            <Link href="/precyflow/login" className="pf-btn-ghost">Entrar</Link>
            <Link href="/precyflow/cadastro" className="pf-btn-primary">Criar conta grátis</Link>
          </div>
        </header>

        <main className="px-5 lg:px-12 pb-20">
          <section className="max-w-3xl mx-auto text-center pt-10 pb-14">
            <h1 className="text-3xl lg:text-5xl font-extrabold leading-tight mb-5" style={{ color: 'var(--pf-text)' }}>
              Gestão simples para o seu ateliê crescer
            </h1>
            <p className="text-base lg:text-lg mb-8" style={{ color: 'var(--pf-text-secondary)' }}>
              Catálogo, materiais, pedidos, clientes, orçamentos, caixa, estoque e uma
              vitrine online — tudo em português, em reais, sem complicação.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/precyflow/cadastro" className="pf-btn-primary">Começar agora</Link>
              <Link href="/precyflow/login" className="pf-btn-secondary">Já sou cliente</Link>
            </div>
          </section>

          <section className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="pf-card">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--pf-primary) 12%, transparent)' }}
                >
                  <Icon size={20} style={{ color: 'var(--pf-primary)' }} />
                </div>
                <h3 className="font-semibold mb-1" style={{ color: 'var(--pf-text)' }}>{title}</h3>
                <p className="text-sm" style={{ color: 'var(--pf-text-secondary)' }}>{desc}</p>
              </div>
            ))}
          </section>
        </main>
      </div>
    </ThemeRoot>
  )
}
