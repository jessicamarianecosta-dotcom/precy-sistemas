'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook compartilhado — carrega companyId do usuário autenticado.
 * Se não encontrar empresa, chama /api/setup-company para criar automaticamente.
 */
export function useCompanyId() {
  const supabase = createClient()

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId,    setUserId]    = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)

  const setupAttempted = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        /* ── 1. Usuário autenticado ── */
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
          if (!cancelled) { setCompanyId(null); setUserId(null); setLoading(false) }
          return
        }

        if (!cancelled) setUserId(user.id)

        /* ── 2. Busca empresa ── */
        const { data, error } = await (supabase.from('companies') as any)
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) {
          console.error('[useCompanyId] company error:', error)
          if (!cancelled) { setCompanyId(null); setLoading(false) }
          return
        }

        if (data?.id) {
          if (!cancelled) setCompanyId(data.id)
          return
        }

        /* ── 3. Sem empresa → criar via API (uma única vez) ── */
        if (!setupAttempted.current) {
          setupAttempted.current = true
          try {
            const res = await fetch('/api/setup-company', { method: 'POST' })
            if (res.ok) {
              const body = await res.json()
              if (!cancelled && body.companyId) {
                setCompanyId(body.companyId)
                return
              }
            }
          } catch (e) {
            console.error('[useCompanyId] setup-company fetch error:', e)
          }
        }

        if (!cancelled) setCompanyId(null)
      } catch (err) {
        console.error('[useCompanyId] unexpected error:', err)
        if (!cancelled) { setCompanyId(null); setUserId(null) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { companyId, userId, loading }
}
