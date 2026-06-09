'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Shared hook — carrega companyId do usuário autenticado.
 * Retorna null enquanto carregando.
 */
export function useCompanyId() {
  const supabase = createClient()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId,    setUserId]    = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) { setLoading(false); return }

        setUserId(user.id)

        const { data: co, error: coError } = await (supabase.from('companies') as any)
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (!coError && co?.id && !cancelled) {
          setCompanyId(co.id)
        }
      } catch (err) {
        console.error('[useCompanyId] erro:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { companyId, userId, loading }
}
