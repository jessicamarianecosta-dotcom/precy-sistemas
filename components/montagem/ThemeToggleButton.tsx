'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

/**
 * Alternância de tema claro/escuro para a página pública de Montagem (sem
 * login) — o resto do app já tem isso no menu lateral, mas essa página roda
 * fora dele. `mounted` evita divergência entre o HTML do servidor (que não
 * sabe o tema salvo no navegador) e o primeiro render no cliente.
 */
export function ThemeToggleButton() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="w-9 h-9" aria-hidden="true" />

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="p-2 rounded-lg border border-border dark:border-border-dark text-text-secondary dark:text-stone-400 hover:bg-primary-50 dark:hover:bg-white/5 hover:text-primary transition-colors"
      title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
