'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, Boxes, ShoppingCart,
  Users, FileText, DollarSign, Settings, Calculator,
  ChevronLeft, ChevronRight, Lock, LogOut, Moon, Sun, CalendarDays,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { useSidebar } from '@/providers/SidebarProvider'

/* ─── Menu ─── */
const menuItems = [
  {
    title: 'Principal',
    items: [
      { href: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard'     },
      { href: '/precificacao',icon: Calculator,       label: 'Precificação'  },
    ],
  },
  {
    title: 'Negócio',
    items: [
      { href: '/produtos',    icon: Package,     label: 'Produtos'  },
      { href: '/estoque',     icon: Boxes,       label: 'Estoque'   },
      { href: '/pedidos',     icon: ShoppingCart,label: 'Pedidos'   },
      { href: '/agenda',      icon: CalendarDays,label: 'Agenda'    },
      { href: '/clientes',    icon: Users,       label: 'Clientes'  },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { href: '/orcamentos',  icon: FileText,   label: 'Orçamentos' },
      { href: '/financeiro',  icon: DollarSign, label: 'Financeiro' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { href: '/configuracoes', icon: Settings, label: 'Configurações' },
    ],
  },
]

const comingSoon = ['IA de Precificação', 'WhatsApp']

/* ─── SidebarInner (shared between drawer and fixed) ─── */
function SidebarInner({ collapsed, onClose }: { collapsed: boolean; onClose?: () => void }) {
  const pathname  = usePathname()
  const { theme, setTheme } = useTheme()
  const router    = useRouter()
  const supabase  = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    onClose?.()
    router.push('/login')
  }

  function NavLink({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link
        href={href}
        onClick={onClose}
        className={clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
          active
            ? 'bg-primary text-white shadow-sm'
            : 'text-text-secondary dark:text-stone-400 hover:bg-primary-50 dark:hover:bg-white/5 hover:text-primary dark:hover:text-stone-200',
          collapsed && 'justify-center px-2'
        )}
        title={collapsed ? label : undefined}
      >
        <Icon size={18} className="flex-shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-surface-dark border-r border-border dark:border-border-dark">
      {/* Logo */}
      <div className="p-4 flex items-center justify-between border-b border-border dark:border-border-dark flex-shrink-0">
        {!collapsed ? (
          <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-white font-bold text-sm">P+</span>
            </div>
            <span className="font-bold text-text-primary dark:text-stone-100">
              Precy<span className="text-primary">+</span>
            </span>
          </Link>
        ) : (
          <Link href="/dashboard" onClick={onClose} className="mx-auto">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">P+</span>
            </div>
          </Link>
        )}
        {!collapsed && (
          <button
            onClick={() => {}}
            className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-primary-50 dark:hover:bg-white/5 lg:flex hidden"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5 no-scrollbar">
        {menuItems.map(group => (
          <div key={group.title}>
            {!collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted dark:text-stone-500 px-3 mb-1.5">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(item => (
                <li key={item.href}>
                  <NavLink href={item.href} icon={item.icon} label={item.label} />
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Em breve */}
        {!collapsed && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted dark:text-stone-500 px-3 mb-1.5">
              Em breve
            </p>
            <div className="space-y-0.5 opacity-60">
              {comingSoon.map(item => (
                <div key={item} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-muted dark:text-stone-500 cursor-not-allowed">
                  <Lock size={15} />
                  <span className="truncate">{item}</span>
                  <span className="ml-auto badge badge-primary text-[10px] py-0 px-1.5">Soon</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border dark:border-border-dark space-y-1 flex-shrink-0">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
            'text-text-secondary dark:text-stone-400 hover:bg-primary-50 dark:hover:bg-white/5 hover:text-primary',
            collapsed && 'justify-center'
          )}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {!collapsed && <span>{theme === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>}
        </button>
        <button
          onClick={handleLogout}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
            'text-error hover:bg-error-light',
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

/* ─── Main Sidebar export ─── */
export function Sidebar() {
  const { open, collapsed, closeDrawer, toggleCollapsed } = useSidebar()

  return (
    <>
      {/* ── MOBILE: overlay drawer ── */}
      <div className="lg:hidden">
        {/* Backdrop */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={closeDrawer}
          />
        )}

        {/* Drawer */}
        <aside
          className={clsx(
            'fixed left-0 top-0 h-full z-50 w-[280px] transition-transform duration-300 ease-in-out',
            open ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <SidebarInner collapsed={false} onClose={closeDrawer} />
        </aside>
      </div>

      {/* ── DESKTOP: fixed sidebar ── */}
      <aside
        className={clsx(
          'hidden lg:flex flex-col fixed left-0 top-0 h-full z-40 transition-all duration-300',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        <div className="h-full flex flex-col relative">
          <SidebarInner collapsed={collapsed} />
          {/* Desktop collapse toggle */}
          <button
            onClick={toggleCollapsed}
            className={clsx(
              'absolute -right-3 top-20 w-6 h-6 rounded-full bg-white dark:bg-surface-dark border border-border dark:border-border-dark',
              'flex items-center justify-center shadow-sm text-text-muted hover:text-primary transition-colors z-50'
            )}
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>
      </aside>
    </>
  )
}
