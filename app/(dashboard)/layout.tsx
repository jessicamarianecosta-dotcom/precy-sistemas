import { Sidebar } from '@/components/layout/Sidebar'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark">
      <Sidebar />

      {/* Main area — shifts right on lg when sidebar is visible */}
      <main className="min-h-screen overflow-x-hidden
        lg:ml-60 transition-all duration-300">
        {children}
      </main>
    </div>
  )
}
