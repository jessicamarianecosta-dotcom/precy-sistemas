'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function usePrecyflowCompany() {
  const supabase = createClient()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (active) setLoading(false); return }
      const { data: company } = await supabase.from('companies').select('id, name').eq('user_id', user.id).single() as any
      if (active) {
        if (company) { setCompanyId(company.id); setCompanyName(company.name ?? '') }
        setLoading(false)
      }
    }
    load()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { companyId, companyName, loading }
}
