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
  Trash2,
  Loader2,
  Save,
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

  const [tab, setTab] = useState<Tab>('perfil')
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
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .single()

      return data
    },
  })

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId!)
        .single()

      return data
    },
  })

  const { data: fixedCosts } = useQuery({
    queryKey: ['fixed-costs', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from('fixed_costs')
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at')

      return data ?? []
    },
  })

  const { data: subscription } = useQuery({
    queryKey: ['subscription', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId!)
        .single()

      return data
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
        name: profile.name ?? '',
      })
    }
  }, [profile, profForm])

  useEffect(() => {
    if (company) {
      coForm.reset({
        name: company.name,
        email: company.email ?? '',
        phone: company.phone ?? '',
        cnpj: company.cnpj ?? '',
        address: company.address ?? '',
        work_hours_per_month: company.work_hours_per_month ?? 160,
      })
    }
  }, [company, coForm])

  function showSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const saveProfile = useMutation({
    mutationFn: async (d: ProfileForm) => {
      await supabase
        .from('profiles')
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
      await supabase
        .from('companies')
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

  const deleteCost = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from('fixed_costs')
        .delete()
        .eq('id', id)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['fixed-costs', companyId],
      })
    },
  })

  const totalFixedCosts =
    fixedCosts?.reduce((s: number, c: any) => s + Number(c.amount), 0) ?? 0

  const tabs = [
    { id: 'perfil', label: 'Perfil', icon: User },
    { id: 'empresa', label: 'Meu Negócio', icon: Building2 },
    { id: 'custos', label: 'Custos Fixos', icon: DollarSign },
    { id: 'plano', label: 'Meu Plano', icon: CreditCard },
  ] as const

  return (
    <div className="page-enter">
      <Header
        title="Configurações"
        subtitle="Gerencie sua conta e empresa"
      />

      <div className="p-6">
        <div className="card">
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
