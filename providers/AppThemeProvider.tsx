'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/hooks/useCompanyId'
import { APP_PALETTES, DEFAULT_PALETTE, isValidPaletteId, type AppPaletteId } from '@/lib/theme/palettes'

const STORAGE_KEY = 'precy_app_palette'

/** Aplica o atributo na tag <html> — mesmo mecanismo usado pelo script inline em app/layout.tsx. */
function applyPaletteAttribute(id: AppPaletteId) {
  document.documentElement.setAttribute('data-palette', id)
}

interface AppThemeContextValue {
  palette: AppPaletteId
  setPalette: (id: AppPaletteId) => void
  /** true enquanto ainda não sincronizou com o valor salvo na empresa (Supabase). */
  syncing: boolean
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null)

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { companyId } = useCompanyId()

  const [palette, setPaletteState] = useState<AppPaletteId>(DEFAULT_PALETTE)
  const [syncing, setSyncing] = useState(true)
  const hydratedFromDb = useRef(false)

  /* ── 1. Na montagem, lê o que o script inline já aplicou (localStorage) para manter o estado React coerente com o DOM — sem flash, pois o atributo já está correto desde antes da pintura. ── */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (isValidPaletteId(stored)) setPaletteState(stored)
    } catch { /* ignore */ }
  }, [])

  /* ── 2. Quando a empresa carrega, busca a preferência salva no Supabase — fonte de verdade entre dispositivos. Só sobrescreve o estado local se vier diferente, evitando re-render/flash desnecessário. ── */
  useEffect(() => {
    if (!companyId || hydratedFromDb.current) return
    hydratedFromDb.current = true

    async function load() {
      try {
        const { data } = await (supabase.from('companies') as any)
          .select('ui_theme_palette')
          .eq('id', companyId)
          .maybeSingle()

        const dbValue = data?.ui_theme_palette
        if (isValidPaletteId(dbValue)) {
          setPaletteState(dbValue)
          applyPaletteAttribute(dbValue)
          try { localStorage.setItem(STORAGE_KEY, dbValue) } catch { /* ignore */ }
        }
      } catch { /* ignore — mantém a preferência local */ }
      finally {
        setSyncing(false)
      }
    }
    load()
  }, [companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!companyId) setSyncing(false)
  }, [companyId])

  const setPalette = useCallback((id: AppPaletteId) => {
    setPaletteState(id)
    applyPaletteAttribute(id)
    try { localStorage.setItem(STORAGE_KEY, id) } catch { /* ignore */ }

    if (companyId) {
      ;(supabase.from('companies') as any)
        .update({ ui_theme_palette: id, updated_at: new Date().toISOString() })
        .eq('id', companyId)
        .then(({ error }: { error: unknown }) => {
          if (error) console.error('[AppThemeProvider] erro ao salvar paleta:', error)
        })
    }
  }, [companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppThemeContext.Provider value={{ palette, setPalette, syncing }}>
      {children}
    </AppThemeContext.Provider>
  )
}

export function useAppTheme() {
  const ctx = useContext(AppThemeContext)
  if (!ctx) throw new Error('useAppTheme deve ser usado dentro de <AppThemeProvider>')
  return ctx
}

export { APP_PALETTES }
