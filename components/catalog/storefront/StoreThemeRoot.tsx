'use client'

import { useEffect, useState, createContext, useContext, type ReactNode, type CSSProperties } from 'react'
import { Sun, Moon } from 'lucide-react'
import type { StoreThemePalettes, StoreThemeMode } from '@/lib/catalog/theme/palette'
import { paletteToCssVars } from '@/lib/catalog/theme/palette'

const STORAGE_KEY = 'loja-theme-mode'

function readStoredMode(): StoreThemeMode {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/**
 * Envolve as páginas da loja pública, aplicando a paleta da empresa via CSS custom
 * properties (--store-*). O visitante escolhe claro/escuro com o botão exportado
 * abaixo (StoreThemeToggle) — alternância própria da loja, independente do painel admin.
 */
export function StoreThemeRoot({ palettes, children }: { palettes: StoreThemePalettes; children: ReactNode }) {
  const [mode, setMode] = useState<StoreThemeMode>('light')

  useEffect(() => {
    setMode(readStoredMode())
  }, [])

  const vars = paletteToCssVars(palettes[mode])

  return (
    <div
      data-store-theme={mode}
      style={vars as CSSProperties}
      className="contents"
    >
      <StoreThemeModeContext.Provider value={{ mode, setMode }}>
        {children}
      </StoreThemeModeContext.Provider>
    </div>
  )
}

const StoreThemeModeContext = createContext<{ mode: StoreThemeMode; setMode: (m: StoreThemeMode) => void } | null>(null)

export function useStoreThemeMode() {
  const ctx = useContext(StoreThemeModeContext)
  if (!ctx) throw new Error('useStoreThemeMode deve ser usado dentro de StoreThemeRoot')
  return ctx
}

export function StoreThemeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useStoreThemeMode()

  function toggle() {
    const next: StoreThemeMode = mode === 'light' ? 'dark' : 'light'
    setMode(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch { /* localStorage indisponível (modo privado, etc.) — ignora */ }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={mode === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}
      className={className ?? 'flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.15] backdrop-blur-[10px] border border-white/10 text-white hover:bg-white/25 transition-colors'}
    >
      {mode === 'light' ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  )
}
