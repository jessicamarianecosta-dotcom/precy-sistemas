'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Package, Boxes, ShoppingCart, Users, FileText,
  DollarSign, Settings, CalendarDays, CheckSquare, Truck, Store,
  BarChart2, ChevronLeft, ChevronRight, LogOut, Cat, Sparkles,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useSidebar } from '@/providers/SidebarProvider'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { usePrecyflowTheme } from '@/providers/PrecyflowThemeProvider'

/* 14 módulos aprovados do PrecyFlow (documento, seção 9) — Precificação
   fica de fora por decisão explícita do escopo. */
const MENU_ITEMS = [
  { href: '/precyflow/app',               icon: LayoutDashboard, label: 'Dashboard'       },
  { href: '/precyflow/app/produtos',      icon: Package,         label: 'Produtos'        },
  { href: '/precyflow/app/materiais',     icon: Boxes,           label: 'Materiais'       },
  { href: '/precyflow/app/pedidos',       icon: ShoppingCart,    label: 'Pedidos'         },
  { href: '/precyflow/app/clientes',      icon: Users,           label: 'Clientes'        },
  { href: '/precyflow/app/orcamentos',    icon: FileText,        label: 'Orçamentos'      },
  { href: '/precyflow/app/financeiro',    icon: DollarSign,      label: 'Financeiro'      },
  { href: '/precyflow/app/estoque',       icon: Boxes,           label: 'Estoque'         },
  { href: '/precyflow/app/agenda',        icon: CalendarDays,    label: 'Agenda'          },
  { href: '/precyflow/app/tarefas',       icon: CheckSquare,     label: 'Tarefas'         },
  { href: '/precyflow/app/fornecedores',  icon: Truck,           label: 'Fornecedores'    },
  { href: '/precyflow/app/vitrine',       icon: Store,           label: 'Vitrine Virtual' },
  { href: '/precyflow/app/relatorios',    icon: BarChart2,       label: 'Relatórios'      },
  { href: '/precyflow/app/configuracoes', icon: Settings,        label: 'Configurações'   },
]

function PrecyflowSidebarInner({ collapsed, onClose }: { collapsed: boolean; onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const { theme } = usePrecyflowTheme()

  async function handleLogout() {
    queryClient.clear()
    await supabase.auth.signOut()
    onClose?.()
    router.push('/precyflow/login')
  }

  function NavLink({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
    const active = pathname === href || (href !== '/precyflow/app' && pathname.startsWith(href + '/'))
    return (
      <Link
        href={href}
        onClick={onClose}
        className={clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
          active ? 'pf-btn-primary' : 'text-[var(--pf-text-secondary)] hover:pf-bg-primary-soft hover:pf-text-primary-accent',
          collapsed && 'justify-center px-2'
        )}
        title={collapsed ? label : undefined}
      >
        <Icon size={18} className="flex-shrink-0" />
        {!collapsed && <span className="truncate flex-1">{label}</span>}
      </Link>
    )
  }

  return (
    <div className="h-full flex flex-col pf-card rounded-none border-l-0 border-t-0 border-b-0">
      <div className="p-4 flex items-center gap-2.5 border-b" style={{ borderColor: 'var(--pf-border)' }}>
        <Link href="/precyflow/app" onClick={onClose} className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 pf-btn-primary">
            {theme === 'cat' ? <Cat size={18} /> : <Sparkles size={18} />}
          </div>
          {!collapsed && (
            <span className="font-bold truncate">
              Precy<span className="pf-text-primary-accent">Flow</span>
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5 no-scrollbar">
        {MENU_ITEMS.map(item => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      <div className="p-3 border-t" style={{ borderColor: 'var(--pf-border)' }}>
        <button
          onClick={handleLogout}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-error hover:bg-error-light',
            collapsed && 'justify-center'
          )}
        >
          <LogOut size={16} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </div>
  )
}

export function PrecyflowSidebar() {
  const { open, collapsed, closeDrawer, toggleCollapsed } = useSidebar()

  return (
    <>
      <div className="lg:hidden">
        {open && (
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={closeDrawer} />
        )}
        <aside
          className={clsx(
            'fixed left-0 top-0 h-full z-50 w-[280px] transition-transform duration-300 ease-in-out',
            open ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <PrecyflowSidebarInner collapsed={false} onClose={closeDrawer} />
        </aside>
      </div>

      <aside
        className={clsx(
          'hidden lg:flex flex-col fixed left-0 top-0 h-full z-40 transition-all duration-300',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        <div className="h-full flex flex-col relative">
          <PrecyflowSidebarInner collapsed={collapsed} />
          <button
            onClick={toggleCollapsed}
            className="absolute -right-3 top-20 w-6 h-6 rounded-full pf-card flex items-center justify-center z-50"
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>
      </aside>
    </>
  )
}
