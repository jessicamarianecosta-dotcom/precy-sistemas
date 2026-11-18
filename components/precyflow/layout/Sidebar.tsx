'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import {
  LayoutDashboard, Package, Boxes, ShoppingCart, Users, FileText,
  DollarSign, Archive, CalendarDays, CheckSquare, Truck, Store,
  BarChart2, Settings, LogOut, X,
} from 'lucide-react'
import { createClient } from '@/lib/precyflow/supabase-client'
import { Logo } from '@/components/precyflow/Logo'
import { Mascot } from '@/components/precyflow/Mascot'

const NAV_ITEMS = [
  { href: '/precyflow/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/precyflow/app/produtos', icon: Package, label: 'Produtos' },
  { href: '/precyflow/app/materiais', icon: Boxes, label: 'Materiais' },
  { href: '/precyflow/app/pedidos', icon: ShoppingCart, label: 'Pedidos' },
  { href: '/precyflow/app/clientes', icon: Users, label: 'Clientes' },
  { href: '/precyflow/app/orcamentos', icon: FileText, label: 'Orçamentos' },
  { href: '/precyflow/app/financeiro', icon: DollarSign, label: 'Financeiro' },
  { href: '/precyflow/app/estoque', icon: Archive, label: 'Estoque' },
  { href: '/precyflow/app/agenda', icon: CalendarDays, label: 'Agenda' },
  { href: '/precyflow/app/tarefas', icon: CheckSquare, label: 'Tarefas' },
  { href: '/precyflow/app/fornecedores', icon: Truck, label: 'Fornecedores' },
  { href: '/precyflow/app/vitrine', icon: Store, label: 'Vitrine Virtual' },
  { href: '/precyflow/app/relatorios', icon: BarChart2, label: 'Relatórios' },
  { href: '/precyflow/app/configuracoes', icon: Settings, label: 'Configurações' },
]

export function Sidebar({
  theme,
  mobileOpen,
  onCloseMobile,
}: {
  theme: 'cat' | 'cores'
  mobileOpen: boolean
  onCloseMobile: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/precyflow/login')
    router.refresh()
  }

  const content = (
    <div className="flex h-full flex-col" style={{ backgroundColor: 'var(--pf-surface)', borderRight: '1px solid var(--pf-border)' }}>
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          {theme === 'cat' && <Mascot size={32} />}
          <Logo subtitle={false} />
        </div>
        <button onClick={onCloseMobile} className="lg:hidden" aria-label="Fechar menu" style={{ color: 'var(--pf-text-secondary)' }}>
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 space-y-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={onCloseMobile}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor: active ? 'color-mix(in srgb, var(--pf-primary) 12%, transparent)' : 'transparent',
                color: active ? 'var(--pf-primary)' : 'var(--pf-text-secondary)',
              }}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
          style={{ color: 'var(--pf-text-secondary)' }}
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:block lg:fixed lg:inset-y-0 lg:w-64">{content}</aside>

      {/* Mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onCloseMobile} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">{content}</aside>
        </div>
      )}
    </>
  )
}
