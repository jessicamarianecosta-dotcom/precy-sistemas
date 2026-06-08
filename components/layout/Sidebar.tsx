'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Users,
  FileText,
  DollarSign,
  Settings,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Lock,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'

const menuItems = [
  {
    title: 'Principal',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/precificacao', icon: Calculator, label: 'Precificação' },
    ],
  },
  {
    title: 'Negócio',
    items: [
      { href: '/produtos', icon: Package, label: 'Produtos' },
      { href: '/estoque', icon: Boxes, label: 'Estoque' },
      { href: '/pedidos', icon: ShoppingCart, label: 'Pedidos' },
      { href: '/clientes', icon: Users, label: 'Clientes' },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { href: '/orcamentos', icon: FileText, label: 'Orçamentos' },
      { href: '/financeiro', icon: DollarSign, label: 'Financeiro' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { href: '/configuracoes', icon: Settings, label: 'Configurações' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-full z-40 flex flex-col',
        'bg-white dark:bg-surface-dark border-r border-border dark:border-border-dark',
        'transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="p-4 flex items-center justify-between border-b border-border dark:border-border-dark">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-white font-bold text-sm">P+</span>
            </div>
            <span className="font-bold text-text-primary dark:text-stone-100">
              Precy<span className="text-primary">+</span>
            </span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="mx-auto">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">P+</span>
            </div>
          </Link>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="text-text-muted hover:text-text-primary dark:hover:text-stone-200 transition-colors p-1 rounded-lg hover:bg-primary-50 dark:hover:bg-white/5"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Collapse button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-2 text-text-muted hover:text-text-primary dark:hover:text-stone-200 transition-colors p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-white/5"
        >
          <ChevronRight size={14} />
        </button>
      )}

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5 no-scrollbar">
        {menuItems.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted dark:text-stone-500 px-3 mb-1.5">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={clsx(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-text-secondary dark:text-stone-400 hover:bg-primary-50 dark:hover:bg-white/5 hover:text-primary dark:hover:text-stone-200',
                        collapsed && 'justify-center px-2'
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon size={18} className="flex-shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {/* Em Breve */}
        {!collapsed && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted dark:text-stone-500 px-3 mb-1.5">
              Em breve
            </p>
            <div className="space-y-0.5 opacity-60">
              {['IA de Precificação', 'WhatsApp', 'Agenda'].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-muted dark:text-stone-500 cursor-not-allowed"
                >
                  <Lock size={15} />
                  <span>{item}</span>
                  <span className="ml-auto badge badge-primary text-[10px] py-0 px-1.5">Soon</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border dark:border-border-dark space-y-1">
        {/* Dark mode */}
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

        {/* Logout */}
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
    </aside>
  )
}
