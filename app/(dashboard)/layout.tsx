import { Suspense } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { MainContent } from '@/components/layout/MainContent'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CheckoutSuccessSync } from '@/components/subscription/CheckoutSuccessSync'

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
      <Suspense fallback={null}>
        <CheckoutSuccessSync />
      </Suspense>
      <Sidebar />
      <MainContent>{children}</MainContent>
    </div>
  )
}
