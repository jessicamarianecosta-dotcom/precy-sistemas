'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook compartilhado — carrega companyId do usuário autenticado.
 * Se não encontrar empresa, tenta criar diretamente com o cliente autenticado.
 * O usuário já está logado quando este hook roda, então auth.uid() funciona.
 */
export function useCompanyId() {
  const supabase = createClient()

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId,    setUserId]    = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)

  const createAttempted = useRef(false)

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
        const { data: co, error: coErr } = await (supabase.from('companies') as any)
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (coErr) {
          console.error('[useCompanyId] company fetch error:', coErr)
          if (!cancelled) { setCompanyId(null); setLoading(false) }
          return
        }

        if (co?.id) {
          if (!cancelled) setCompanyId(co.id)
          setLoading(false)
          return
        }

        /* ── 3. Sem empresa → tentar criar com cliente autenticado ── */
        if (createAttempted.current) {
          if (!cancelled) setLoading(false)
          return
        }
        createAttempted.current = true

        const companyName =
          (user.user_metadata?.company_name as string) ||
          user.email?.split('@')[0] ||
          'Meu Negócio'

        const { data: newCo, error: createErr } = await (supabase.from('companies') as any)
          .insert({
            user_id:              user.id,
            name:                 companyName,
            email:                user.email ?? '',
            work_hours_per_month: 160,
            fixed_costs:          0,
            currency:             'BRL',
            timezone:             'America/Sao_Paulo',
          })
          .select('id')
          .single()

        if (createErr) {
          console.error('[useCompanyId] company create error:', createErr)
          // Tenta via API route como fallback (usa service role)
          try {
            const res = await fetch('/api/setup-company', { method: 'POST' })
            if (res.ok) {
              const body = await res.json()
              if (!cancelled && body.companyId) {
                setCompanyId(body.companyId)
                return
              }
            }
          } catch (apiErr) {
            console.error('[useCompanyId] API fallback error:', apiErr)
          }
          if (!cancelled) setCompanyId(null)
          return
        }

        if (!cancelled && newCo?.id) {
          setCompanyId(newCo.id)
        }
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
