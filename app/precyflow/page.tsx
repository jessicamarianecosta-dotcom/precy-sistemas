import Link from 'next/link'
import { PLANS } from '@/lib/stripe/plans'

const MODULES = [
  { img: 'dashboard', label: 'Dashboard' },
  { img: 'produtos', label: 'Produtos' },
  { img: 'materiais', label: 'Materiais' },
  { img: 'pedidos', label: 'Pedidos' },
  { img: 'clientes', label: 'Clientes' },
  { img: 'orcamentos', label: 'Orçamentos' },
  { img: 'financeiro', label: 'Financeiro' },
  { img: 'estoque', label: 'Estoque' },
  { img: 'agenda', label: 'Agenda' },
  { img: 'tarefas', label: 'Tarefas' },
  { img: 'fornecedores', label: 'Fornecedores' },
  { img: 'vitrine-digital', label: 'Vitrine Virtual' },
  { img: 'dashboard', label: 'Relatórios' },
  { img: 'configuracoes', label: 'Configurações' },
]

const BENEFITS = [
  { img: 'gestao-pedidos', title: 'Pedidos organizados', text: 'Do "a confirmar" ao "entregue", sem perder nada de vista.' },
  { img: 'controle-estoque', title: 'Estoque sob controle', text: 'Saiba exatamente o que repor, de produtos e de materiais.' },
  { img: 'vitrine-online', title: 'Loja online inclusa', text: 'Vitrine pública e checkout prontos para vender fora das redes.' },
  { img: 'financeiro-claro', title: 'Financeiro claro', text: 'Entradas, saídas e a receber do seu jeito, sem planilha.' },
]

export default function PrecyflowLandingPage() {
  return (
    <div style={{ backgroundColor: 'var(--pf-bg)' }} className="min-h-screen">
      <header className="flex items-center justify-between px-4 sm:px-8 py-5 max-w-5xl mx-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/precyflow/wordmark.png" alt="PrecyFlow" className="h-7 sm:h-8 object-contain" />
        <div className="flex items-center gap-3">
          <Link href="/precyflow/login" className="text-sm font-medium hover:underline">Entrar</Link>
          <Link href="/precyflow/cadastro" className="pf-btn-primary text-sm px-4 py-2">Criar conta</Link>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12 text-center relative">
        <div className="relative w-36 h-36 mx-auto mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/precyflow/coracoes-brilhos.png" alt="" className="absolute inset-0 w-full h-full object-contain scale-150 opacity-80" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/precyflow/mascote/gatinho-oficial.png" alt="Mascote PrecyFlow" className="relative w-full h-full object-contain" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">
          Gestão simples para o seu ateliê
        </h1>
        <p className="text-base sm:text-lg mb-8" style={{ color: 'var(--pf-text-secondary)' }}>
          Organize catálogo, materiais, pedidos, clientes, orçamentos, caixa, estoque
          e sua loja online em um só lugar — sem complicação.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/precyflow/cadastro" className="pf-btn-primary px-6 py-3 w-full sm:w-auto text-center">
            Criar conta — {PLANS.precyflow.priceLabel}
          </Link>
          <Link href="/precyflow/login" className="pf-card px-6 py-3 w-full sm:w-auto text-center font-medium">
            Já tenho conta
          </Link>
        </div>
        <p className="text-xs mt-4" style={{ color: 'var(--pf-text-muted)' }}>
          Assinatura única anual · até 300 produtos cadastrados
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-8 pb-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BENEFITS.map(b => (
            <div key={b.img} className="pf-card p-4 flex flex-col items-center text-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/precyflow/${b.img}.png`} alt="" className="w-16 h-16 object-contain" aria-hidden />
              <p className="text-sm font-semibold">{b.title}</p>
              <p className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-8 pb-16">
        <h2 className="text-xl font-bold text-center mb-8">Tudo que o seu negócio precisa</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MODULES.map(({ img, label }) => (
            <div key={label} className="pf-card p-4 flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center pf-bg-primary-soft overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/precyflow/modulos/${img}.png`} alt="" className="w-9 h-9 object-contain" aria-hidden />
              </div>
              <span className="text-sm font-medium">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-6 text-center text-xs" style={{ borderColor: 'var(--pf-border)', color: 'var(--pf-text-muted)' }}>
        <div className="flex items-center justify-center gap-4">
          <Link href="/termos" className="hover:underline">Termos de Uso</Link>
          <Link href="/privacidade" className="hover:underline">Privacidade</Link>
          <Link href="/suporte" className="hover:underline">Suporte</Link>
        </div>
      </footer>
    </div>
  )
}
