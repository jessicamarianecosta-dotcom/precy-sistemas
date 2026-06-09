'use client'

import { Bell, Search, ChevronDown, Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSidebar } from '@/providers/SidebarProvider'

interface Props {
  title:    string
  subtitle?: string
}

export function Header({ title, subtitle }: Props) {
  const supabase           = createClient()
  const { toggleOpen }     = useSidebar()
  const [userName,  setUserName]  = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles').select('name, avatar_url').eq('id', user.id).single() as any
        if (profile) {
          setUserName((profile as any).name || user.email?.split('@')[0] || 'Usuária')
          setAvatarUrl((profile as any).avatar_url)
        }
      }
    }
    loadUser()
  }, [])

  const initials = userName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header className="sticky top-0 z-30 bg-background/90 dark:bg-background-dark/90 backdrop-blur-xl border-b border-border dark:border-border-dark px-3 sm:px-6 py-3">
      <div className="flex items-center justify-between gap-3 min-w-0">

        {/* Left: hamburger (mobile) + title */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Hamburger — only mobile */}
          <button
            onClick={toggleOpen}
            className="lg:hidden p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-secondary dark:text-stone-400 flex-shrink-0"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>

          {/* Title block */}
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-text-primary dark:text-stone-100 truncate leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-text-secondary dark:text-stone-400 truncate hidden sm:block mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Search — hidden on small mobile */}
          <div className="hidden md:flex items-center gap-2 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl px-3 py-2 w-44 lg:w-52">
            <Search size={13} className="text-text-muted flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar..."
              className="bg-transparent text-xs text-text-primary dark:text-stone-200 placeholder:text-text-muted w-full focus:outline-none"
            />
          </div>

          {/* Search icon — only small mobile */}
          <button className="md:hidden p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-secondary dark:text-stone-400">
            <Search size={18} />
          </button>

          {/* Notifications */}
          <button className="relative p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-secondary dark:text-stone-400 transition-colors">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" />
          </button>

          {/* Avatar */}
          <button className="flex items-center gap-2 pl-1 pr-2 sm:pr-3 py-1.5 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 transition-colors">
            <div className="w-7 h-7 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={userName} className="w-7 h-7 rounded-lg object-cover" />
              ) : (
                <span className="text-white text-xs font-bold">{initials || 'U'}</span>
              )}
            </div>
            <span className="text-xs sm:text-sm font-medium text-text-primary dark:text-stone-200 hidden sm:block max-w-[80px] truncate">
              {userName || '...'}
            </span>
            <ChevronDown size={13} className="text-text-muted hidden sm:block" />
          </button>
        </div>
      </div>
    </header>
  )
}
