'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import {
  resolvePrecyflowPalette,
  type PrecyflowTheme,
  type PrecyflowColorId,
} from '@/lib/precyflow/theme'
import { createClient } from '@/lib/supabase/client'

interface PrecyflowThemeContextType {
  theme: PrecyflowTheme
  color: PrecyflowColorId
  setTheme: (theme: PrecyflowTheme) => void
  setColor: (color: PrecyflowColorId) => void
}

const PrecyflowThemeContext = createContext<PrecyflowThemeContextType | null>(null)

export function usePrecyflowTheme() {
  const ctx = useContext(PrecyflowThemeContext)
  if (!ctx) throw new Error('usePrecyflowTheme precisa estar dentro de PrecyflowThemeProvider')
  return ctx
}

export function PrecyflowThemeProvider({
  children,
  initialTheme = 'cat',
  initialColor = 'rosa',
}: {
  children: React.ReactNode
  initialTheme?: PrecyflowTheme
  initialColor?: PrecyflowColorId
}) {
  const [theme, setThemeState] = useState<PrecyflowTheme>(initialTheme)
  const [color, setColorState] = useState<PrecyflowColorId>(initialColor)
  const supabase = useMemo(() => createClient(), [])

  async function persist(next: { theme: PrecyflowTheme; color: PrecyflowColorId }) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await (supabase.from('companies') as any)
      .update({ precyflow_theme: next.theme, precyflow_color: next.color })
      .eq('user_id', user.id)
  }

  function setTheme(next: PrecyflowTheme) {
    setThemeState(next)
    persist({ theme: next, color })
  }

  function setColor(next: PrecyflowColorId) {
    setColorState(next)
    persist({ theme, color: next })
  }

  const palette = resolvePrecyflowPalette(theme, color)

  return (
    <PrecyflowThemeContext.Provider value={{ theme, color, setTheme, setColor }}>
      <div
        className="pf-root"
        data-pf-theme={theme}
        data-pf-color={theme === 'cores' ? color : 'rosa'}
        style={{
          ['--pf-primary' as any]: palette.primary,
          ['--pf-primary-hover' as any]: palette.primaryHover,
          ['--pf-primary-soft' as any]: palette.primarySoft,
        }}
      >
        {children}
      </div>
    </PrecyflowThemeContext.Provider>
  )
}
