import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PrecyflowSidebar } from '@/components/precyflow/Sidebar'
import { PrecyflowMainContent } from '@/components/precyflow/MainContent'

export default async function PrecyflowAppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/precyflow/login')

  return (
    <div className="min-h-screen">
      <PrecyflowSidebar />
      <PrecyflowMainContent>{children}</PrecyflowMainContent>
    </div>
  )
}
