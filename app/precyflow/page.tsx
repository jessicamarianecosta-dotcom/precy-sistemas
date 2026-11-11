import Link from 'next/link'
import {
  Cat, LayoutDashboard, Package, Boxes, ShoppingCart, Users, FileText,
  DollarSign, Settings, CalendarDays, CheckSquare, Truck, Store, BarChart2,
} from 'lucide-react'
import { PLANS } from '@/lib/stripe/plans'

const MODULES = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: Package, label: 'Produtos' },
  { icon: Boxes, label: 'Materiais' },
  { icon: ShoppingCart, label: 'Pedidos' },
  { icon: Users, label: 'Clientes' },
  { icon: FileText, label: 'Orçamentos' },
  { icon: DollarSign, label: 'Financeiro' },
  { icon: Boxes, label: 'Estoque' },
  { icon: CalendarDays, label: 'Agenda' },
  { icon: CheckSquare, label: 'Tarefas' },
  { icon: Truck, label: 'Fornecedores' },
  { icon: Store, label: 'Vitrine Virtual' },
  { icon: BarChart2, label: 'Relatórios' },
  { icon: Settings, label: 'Configurações' },
]

export default function PrecyflowLandingPage() {
  return (
    <div style={{ backgroundColor: 'var(--pf-bg)' }} className="min-h-screen">
      <header className="flex items-center justify-between px-4 sm:px-8 py-5 max-w-5xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center pf-btn-primary">
            <Cat size={18} />
          </div>
          <span className="text-xl font-bold">
            Precy<span className="pf-text-primary-accent">Flow</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/precyflow/login" className="text-sm font-medium hover:underline">Entrar</Link>
          <Link href="/precyflow/cadastro" className="pf-btn-primary text-sm px-4 py-2">Criar conta</Link>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 sm:px-8 py-10 sm:py-16 text-center">
        <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center pf-bg-primary-soft">
          <Cat size={40} className="pf-text-primary-accent" />
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

      <section className="max-w-5xl mx-auto px-4 sm:px-8 pb-16">
        <h2 className="text-xl font-bold text-center mb-8">Tudo que o seu negócio precisa</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MODULES.map(({ icon: Icon, label }) => (
            <div key={label} className="pf-card p-4 flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center pf-bg-primary-soft">
                <Icon size={18} className="pf-text-primary-accent" />
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
