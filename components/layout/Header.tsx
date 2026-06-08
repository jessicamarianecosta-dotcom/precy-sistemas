'use client'

import { Bell, Search, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: Props) {
  const supabase = createClient()
  const [userName, setUserName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, avatar_url')
          .eq('id', user.id)
          .single()
        if (profile) {
          setUserName(profile.name || user.email?.split('@')[0] || 'Usuária')
          setAvatarUrl(profile.avatar_url)
        }
      }
    }
    loadUser()
  }, [])

  const initials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header className="sticky top-0 z-30 bg-background/80 dark:bg-background-dark/80 backdrop-blur-xl border-b border-border dark:border-border-dark px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        {/* Title */}
        <div>
          <h1 className="text-lg font-semibold text-text-primary dark:text-stone-100">{title}</h1>
          {subtitle && <p className="text-xs text-text-secondary dark:text-stone-400 mt-0.5">{subtitle}</p>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="hidden md:flex items-center gap-2 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl px-3 py-2 w-52">
            <Search size={14} className="text-text-muted flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar..."
              className="bg-transparent text-sm text-text-primary dark:text-stone-200 placeholder:text-text-muted w-full focus:outline-none"
            />
          </div>

          {/* Notifications */}
          <button className="relative p-2.5 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-secondary dark:text-stone-400 transition-colors">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full"></span>
          </button>

          {/* User */}
          <button className="flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 transition-colors">
            <div className="w-7 h-7 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName} className="w-7 h-7 rounded-lg object-cover" />
              ) : (
                <span className="text-white text-xs font-bold">{initials || 'U'}</span>
              )}
            </div>
            <span className="text-sm font-medium text-text-primary dark:text-stone-200 hidden md:block">
              {userName || '...'}
            </span>
            <ChevronDown size={14} className="text-text-muted hidden md:block" />
          </button>
        </div>
      </div>
    </header>
  )
}
