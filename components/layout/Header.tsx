'use client'

import { Bell, Search, ChevronDown, Menu, AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSidebar } from '@/providers/SidebarProvider'
import { useFinancialAlerts } from '@/hooks/useFinancialAlerts'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'

interface Props {
  title:    string
  subtitle?: string
}

export function Header({ title, subtitle }: Props) {
  const supabase           = createClient()
  const router             = useRouter()
  const { toggleOpen }     = useSidebar()
  const [userName,  setUserName]  = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [showAlerts, setShowAlerts] = useState(false)
  const alertsRef = useRef<HTMLDivElement>(null)
  const { data: alerts } = useFinancialAlerts()

  /* Fechar dropdown ao clicar fora */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) {
        setShowAlerts(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
          <div className="relative" ref={alertsRef}>
            <button
              onClick={() => setShowAlerts(v => !v)}
              className="relative p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-secondary dark:text-stone-400 transition-colors"
            >
              <Bell size={18} />
              {(alerts?.length ?? 0) > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" />
              )}
            </button>

            {showAlerts && (
              <div className={clsx(
                'absolute right-0 mt-2 w-[min(320px,calc(100vw-1rem))] sm:w-96 max-h-[70vh] overflow-y-auto',
                'bg-white dark:bg-surface-dark border border-border dark:border-border-dark',
                'rounded-2xl shadow-modal z-50 animate-scaleIn origin-top-right'
              )}>
                <div className="flex items-center justify-between p-4 border-b border-border dark:border-border-dark sticky top-0 bg-white dark:bg-surface-dark">
                  <p className="text-sm font-semibold text-text-primary dark:text-stone-100">Alertas</p>
                  <button onClick={() => setShowAlerts(false)} className="p-1 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50">
                    <X size={14} />
                  </button>
                </div>

                {!alerts || alerts.length === 0 ? (
                  <div className="flex flex-col items-center py-10 px-4 text-center">
                    <CheckCircle2 size={28} className="text-success mb-2" />
                    <p className="text-sm font-medium text-text-primary dark:text-stone-100">Tudo certo por aqui!</p>
                    <p className="text-xs text-text-muted dark:text-stone-400 mt-1">Nenhum alerta no momento.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border dark:divide-border-dark">
                    {alerts.map(a => {
                      const Icon = a.severity === 'error' ? AlertCircle
                        : a.severity === 'warning' ? AlertTriangle
                        : a.severity === 'success' ? CheckCircle2
                        : Info
                      const color = a.severity === 'error' ? 'text-error'
                        : a.severity === 'warning' ? 'text-warning'
                        : a.severity === 'success' ? 'text-success'
                        : 'text-info'
                      const bg = a.severity === 'error' ? 'bg-error-light dark:bg-error/10'
                        : a.severity === 'warning' ? 'bg-warning-light dark:bg-warning/10'
                        : a.severity === 'success' ? 'bg-success-light dark:bg-success/10'
                        : 'bg-info-light dark:bg-info/10'
                      return (
                        <button
                          key={a.id}
                          onClick={() => { setShowAlerts(false); if (a.href) router.push(a.href) }}
                          className="w-full flex items-start gap-3 p-4 text-left hover:bg-primary-50/40 dark:hover:bg-white/[0.03] transition-colors"
                        >
                          <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', bg)}>
                            <Icon size={15} className={color} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary dark:text-stone-100 leading-snug break-words">{a.title}</p>
                            <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5 leading-relaxed">{a.message}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

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
