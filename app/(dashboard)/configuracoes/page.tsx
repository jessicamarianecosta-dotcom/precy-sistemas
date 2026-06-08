'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import {
  User,
  Building2,
  CreditCard,
  DollarSign,
  CheckCircle,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

type Tab = 'perfil' | 'empresa' | 'custos' | 'plano'

const profileSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
})

const companySchema = z.object({
  name: z.string().min(2, 'Nome do negócio obrigatório'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  cnpj: z.string().optional(),
  address: z.string().optional(),
  work_hours_per_month: z.coerce.number().min(1).max(744),
})

const fixedCostSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  amount: z.coerce.number().min(0.01, 'Valor obrigatório'),
  category: z.string().default('geral'),
})

type ProfileForm = z.infer<typeof profileSchema>
type CompanyForm = z.infer<typeof companySchema>
type FixedCostForm = z.infer<typeof fixedCostSchema>

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(v)
}

export default function ConfiguracoesPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [tab] = useState<Tab>('perfil')
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      setUserId(user.id)

      const response: any = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (response?.data?.id) {
        setCompanyId(response.data.id)
      }
    }

    load()
  }, [])

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const response: any = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .single()

      return response?.data
    },
  })

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const response: any = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId!)
        .single()

      return response?.data
    },
  })

  const { data: fixedCosts } = useQuery({
    queryKey: ['fixed-costs', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const response: any = await supabase
        .from('fixed_costs')
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at')

      return response?.data ?? []
    },
  })

  const { data: subscription } = useQuery({
    queryKey: ['subscription', userId],
    enabled: !!userId,
    queryFn: async () => {
      const response: any = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId!)
        .single()

      return response?.data
    },
  })

  const profForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  })

  const coForm = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
  })

  const fcForm = useForm<FixedCostForm>({
    resolver: zodResolver(fixedCostSchema),
    defaultValues: {
      category: 'geral',
    },
  })

  useEffect(() => {
    if (profile) {
      profForm.reset({
        name: (profile as any)?.name ?? '',
      })
    }
  }, [profile, profForm])

  useEffect(() => {
    if (company) {
      coForm.reset({
        name: (company as any)?.name ?? '',
        email: (company as any)?.email ?? '',
        phone: (company as any)?.phone ?? '',
        cnpj: (company as any)?.cnpj ?? '',
        address: (company as any)?.address ?? '',
        work_hours_per_month:
          (company as any)?.work_hours_per_month ?? 160,
      })
    }
  }, [company, coForm])

  function showSaved() {
    setSaved(true)

    setTimeout(() => {
      setSaved(false)
    }, 2500)
  }

  const saveProfile = useMutation({
    mutationFn: async (d: ProfileForm) => {
      await (supabase.from('profiles') as any)
        .update({
          name: d.name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId!)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['profile', userId],
      })

      showSaved()
    },
  })

  const saveCompany = useMutation({
    mutationFn: async (d: CompanyForm) => {
      await (supabase.from('companies') as any)
        .update({
          ...d,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId!)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['company', companyId],
      })

      showSaved()
    },
  })

  const addCost = useMutation({
    mutationFn: async (d: FixedCostForm) => {
      await (supabase.from('fixed_costs') as any).insert([
        {
          ...d,
          company_id: companyId!,
        },
      ])
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['fixed-costs', companyId],
      })

      fcForm.reset({
        name: '',
        amount: 0,
        category: 'geral',
      })
    },
  })

  const totalFixedCosts =
    fixedCosts?.reduce(
      (s: number, c: any) => s + Number(c.amount),
      0
    ) ?? 0

  return (
    <div className="page-enter">
      <Header
        title="Configurações"
        subtitle="Gerencie sua conta e empresa"
      />

      <div className="p-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <User size={18} />
            <Building2 size={18} />
            <CreditCard size={18} />
            <DollarSign size={18} />
          </div>

          <h1 className="text-2xl font-bold">
            Configurações
          </h1>

          <p className="mt-2 text-sm opacity-70">
            Página funcionando corretamente.
          </p>

          <div className="mt-4">
            <p className="text-sm">
              Total custos fixos:{' '}
              <strong>{fmt(totalFixedCosts)}</strong>
            </p>

            <p className="mt-2 text-sm">
              Plano:{' '}
              <strong>
                {(subscription as any)?.plan ?? 'basic'}
              </strong>
            </p>

            <p className="mt-2 text-sm">
              Aba atual:{' '}
              <strong>{tab}</strong>
            </p>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() =>
                  saveProfile.mutate({
                    name: 'Usuário',
                  })
                }
                className={clsx(
                  'rounded-lg border px-4 py-2 text-sm'
                )}
              >
                Salvar Perfil
              </button>

              <button
                onClick={() =>
                  saveCompany.mutate({
                    name: 'Empresa',
                    email: '',
                    phone: '',
                    cnpj: '',
                    address: '',
                    work_hours_per_month: 160,
                  })
                }
                className={clsx(
                  'rounded-lg border px-4 py-2 text-sm'
                )}
              >
                Salvar Empresa
              </button>

              <button
                onClick={() =>
                  addCost.mutate({
                    name: 'Aluguel',
                    amount: 100,
                    category: 'geral',
                  })
                }
                className={clsx(
                  'rounded-lg border px-4 py-2 text-sm'
                )}
              >
                Adicionar Custo
              </button>
            </div>

            {saved && (
              <div
                className={clsx(
                  'mt-4 flex items-center gap-2 rounded-lg border p-3 text-sm'
                )}
              >
                <CheckCircle size={16} />
                Alterações salvas com sucesso.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
