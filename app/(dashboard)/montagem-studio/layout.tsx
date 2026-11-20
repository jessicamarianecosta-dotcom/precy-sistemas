import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/* PRECY MONTAGEM (painel interno): liberado apenas para esta conta enquanto
   o módulo está em beta fechado — mesmo padrão de gate usado em
   app/admin/layout.tsx, sem depender de nenhuma flag de plano no banco. */
const ALLOWED_EMAIL = 'jessicamarianecosta@gmail.com'

export default async function MontagemStudioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session || session.user.email !== ALLOWED_EMAIL) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
