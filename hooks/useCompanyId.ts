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

        /* ── 2. Busca empresa ──
           Select simples + order/limit em vez de .maybeSingle(): essa
           variante falha com erro se houver mais de uma linha para o
           mesmo user_id, o que já causou (antes da constraint UNIQUE em
           companies.user_id) usuários ficarem com companyId=null mesmo
           tendo empresa cadastrada. */
        const { data: co, error: coErr } = await (supabase.from('companies') as any)
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1)

        if (coErr) {
          console.error('[useCompanyId] company fetch error:', coErr)
          if (!cancelled) { setCompanyId(null); setLoading(false) }
          return
        }

        if (co?.[0]?.id) {
          if (!cancelled) setCompanyId(co[0].id)
          setLoading(false)
          return
        }

        /* ── 3. Sem empresa → criar via /api/setup-company (server-side) ──
           Essa rota é a única que decide o trial de 7 dias com checagem
           antiabuso (device_id/IP — ver lib/trial/antiAbuse.ts). Um insert
           direto pelo client, como este hook fazia antes, contornava
           completamente essa checagem — qualquer conta nova ganhava o
           bônus de trial sem nenhuma verificação. */
        if (createAttempted.current) {
          if (!cancelled) setLoading(false)
          return
        }
        createAttempted.current = true

        try {
          const res = await fetch('/api/setup-company', { method: 'POST' })
          if (res.ok) {
            const body = await res.json()
            if (!cancelled && body.companyId) {
              setCompanyId(body.companyId)
              return
            }
          }
          throw new Error('setup-company falhou')
        } catch (apiErr) {
          console.error('[useCompanyId] /api/setup-company falhou, usando fallback direto (sem bônus de trial):', apiErr)
        }

        // Fallback de último recurso (rota da API indisponível) — cria a
        // empresa sem conceder o bônus de trial de 7 dias, já que aqui não
        // há como rodar a checagem antiabuso no servidor. A conta funciona
        // normalmente no plano Basic; o trial pode ser reavaliado depois
        // pelo suporte, se for o caso.
        const companyName =
          (user.user_metadata?.company_name as string) ||
          user.email?.split('@')[0] ||
          'Meu Negócio'

        // Upsert com ignoreDuplicates (não insert simples): se este fallback
        // rodar em paralelo em duas abas/efeitos, a constraint UNIQUE em
        // companies.user_id garante que só uma inserção vinga — a outra
        // vira no-op em vez de erro ou linha duplicada.
        const { error: upsertErr } = await (supabase.from('companies') as any)
          .upsert({
            user_id:              user.id,
            name:                 companyName,
            email:                user.email ?? '',
            work_hours_per_month: 160,
            fixed_costs:          0,
            currency:             'BRL',
            timezone:             'America/Sao_Paulo',
            current_plan:         'basic',
            subscription_status:  'trialing',
            trial_end:            new Date().toISOString(),
          }, { onConflict: 'user_id', ignoreDuplicates: true })

        if (upsertErr) {
          console.error('[useCompanyId] company create error:', upsertErr)
          if (!cancelled) setCompanyId(null)
          return
        }

        const { data: newCo, error: reFetchErr } = await (supabase.from('companies') as any)
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1)

        if (reFetchErr) {
          console.error('[useCompanyId] company re-fetch error:', reFetchErr)
          if (!cancelled) setCompanyId(null)
          return
        }

        if (!cancelled && newCo?.[0]?.id) {
          setCompanyId(newCo[0].id)
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
