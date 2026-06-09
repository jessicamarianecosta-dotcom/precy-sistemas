'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook compartilhado para carregar:
 * - companyId da empresa do usuário autenticado
 * - userId do usuário logado
 */

export function useCompanyId() {
  const supabase = createClient()

  const [companyId, setCompanyId] = useState<string | null>(null)

  const [userId, setUserId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        /**
         * Usuário autenticado
         */

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) {
          console.error(
            '[useCompanyId] auth error:',
            authError
          )

          if (!cancelled) {
            setCompanyId(null)
            setUserId(null)
            setLoading(false)
          }

          return
        }

        if (!user) {
          if (!cancelled) {
            setCompanyId(null)
            setUserId(null)
            setLoading(false)
          }

          return
        }

        if (!cancelled) {
          setUserId(user.id)
        }

        /**
         * Busca empresa do usuário
         */

        const { data, error } = await (supabase
          .from('companies') as any)
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()

        /**
         * maybeSingle evita erro 406
         * quando não existe empresa
         */

        if (error) {
          console.error(
            '[useCompanyId] company error:',
            error
          )

          if (!cancelled) {
            setCompanyId(null)
          }

          return
        }

        if (!cancelled) {
          setCompanyId(data?.id ?? null)
        }
      } catch (err) {
        console.error(
          '[useCompanyId] unexpected error:',
          err
        )

        if (!cancelled) {
          setCompanyId(null)
          setUserId(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return {
    companyId,
    userId,
    loading,
  }
}
