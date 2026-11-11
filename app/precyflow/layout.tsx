import '@/styles/precyflow.css'
import { createClient } from '@/lib/supabase/server'
import { PrecyflowThemeProvider } from '@/providers/PrecyflowThemeProvider'
import type { PrecyflowColorId, PrecyflowTheme } from '@/lib/precyflow/theme'

export const metadata = {
  title: {
    default: 'PrecyFlow',
    template: '%s | PrecyFlow',
  },
  description: 'Gestão simples para ateliês e pequenos negócios.',
}

export default async function PrecyflowLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  let theme: PrecyflowTheme = 'cat'
  let color: PrecyflowColorId = 'rosa'

  if (session) {
    const { data: company } = await (supabase.from('companies') as any)
      .select('precyflow_theme, precyflow_color')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (company?.precyflow_theme) theme = company.precyflow_theme
    if (company?.precyflow_color) color = company.precyflow_color
  }

  return (
    <PrecyflowThemeProvider initialTheme={theme} initialColor={color}>
      {children}
    </PrecyflowThemeProvider>
  )
}
