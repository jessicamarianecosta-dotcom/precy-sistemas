import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const ADMIN_EMAIL = 'jessicamarianecosta@gmail.com'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session || session.user.email !== ADMIN_EMAIL) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark">
      {children}
    </div>
  )
}
