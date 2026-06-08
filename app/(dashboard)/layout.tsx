import { Sidebar } from '@/components/layout/Sidebar'
import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerClient()

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark flex">
      <Sidebar />
      <main className="flex-1 ml-60 min-h-screen overflow-x-hidden transition-all duration-300">
        {children}
      </main>
    </div>
  )
}
