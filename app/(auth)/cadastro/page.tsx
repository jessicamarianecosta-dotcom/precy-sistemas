'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ClientesPage() {
  const supabase = createClient()

  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (company) setCompanyId((company as any).id)
    }

    load()
  }, [supabase])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">
        Clientes
      </h1>

      <p className="mt-2 text-sm opacity-70">
        Company ID: {companyId}
      </p>
    </div>
  )
}
