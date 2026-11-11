'use client'

import { useEffect, useState } from 'react'
import { Menu, Search, Bell, HelpCircle, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSidebar } from '@/providers/SidebarProvider'

interface Props {
  title: string
  subtitle?: string
}

export function PrecyflowHeader({ title, subtitle }: Props) {
  const supabase = createClient()
  const { toggleOpen } = useSidebar()
  const [userName, setUserName] = useState('')

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single() as any
      setUserName(profile?.name || user.email?.split('@')[0] || 'Usuária')
    }
    loadUser()
  }, [])

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-xl border-b px-3 sm:px-6 py-3"
      style={{ borderColor: 'var(--pf-border)', backgroundColor: 'color-mix(in srgb, var(--pf-bg) 90%, transparent)' }}
    >
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={toggleOpen}
            className="lg:hidden p-2 rounded-xl hover:pf-bg-primary-soft flex-shrink-0"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold truncate leading-tight">{title}</h1>
            {subtitle && (
              <p className="text-xs truncate hidden sm:block mt-0.5" style={{ color: 'var(--pf-text-secondary)' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div
            className="hidden md:flex items-center gap-2 border rounded-xl px-3 py-2 w-44 lg:w-52"
            style={{ borderColor: 'var(--pf-border)', backgroundColor: 'var(--pf-surface)' }}
          >
            <Search size={13} className="flex-shrink-0" style={{ color: 'var(--pf-text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar no PrecyFlow..."
              className="bg-transparent text-xs w-full focus:outline-none"
            />
          </div>
          <button className="p-2 rounded-xl hover:pf-bg-primary-soft relative flex-shrink-0" aria-label="Notificações">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error" />
          </button>
          <button className="hidden sm:flex p-2 rounded-xl hover:pf-bg-primary-soft flex-shrink-0" aria-label="Ajuda">
            <HelpCircle size={18} />
          </button>
          <div className="flex items-center gap-2 pl-1 flex-shrink-0">
            <div className="w-8 h-8 rounded-full flex items-center justify-center pf-bg-primary-soft">
              <span className="text-xs font-bold pf-text-primary-accent">
                {userName.split(' ').filter(n => /[a-zA-ZÀ-ÿ]/.test(n[0])).map(n => n[0]).slice(0, 2).join('').toUpperCase() || '…'}
              </span>
            </div>
            <div className="hidden sm:block">
              <p className="text-xs sm:text-sm font-semibold leading-tight max-w-[140px] truncate">{userName || '...'}</p>
              <p className="text-[11px] leading-tight" style={{ color: 'var(--pf-text-secondary)' }}>Minha conta</p>
            </div>
            <ChevronDown size={14} className="hidden sm:block" style={{ color: 'var(--pf-text-muted)' }} />
          </div>
        </div>
      </div>
    </header>
  )
}
