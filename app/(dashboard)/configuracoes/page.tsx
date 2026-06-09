'use client'

import { useEffect, useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'

import {
  Building2,
  DollarSign,
  CreditCard,
  Trash2,
  Plus,
  CheckCircle,
  Loader2,
  LogOut,
  Key,
  Upload,
  Instagram,
  Phone,
  MapPin,
  Hash,
  Clock,
  TrendingUp,
  Zap,
  Star,
  AlertCircle,
} from 'lucide-react'

import { clsx } from 'clsx'

import { useForm } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'

import { z } from 'zod'

import { useRouter } from 'next/navigation'

/* =========================================================
   TYPES
========================================================= */

type Tab = 'empresa' | 'financeiro' | 'conta'

/* =========================================================
   SCHEMAS
========================================================= */

const companySchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),

  responsible_name: z.string().optional(),

  phone: z.string().optional(),

  instagram: z.string().optional(),

  city: z.string().optional(),

  state: z.string().optional(),

  email: z
    .string()
    .email('E-mail inválido')
    .optional()
    .or(z.literal('')),

  work_hours_per_month: z.coerce
    .number()
    .min(1)
    .max(744),
})

const fixedCostSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),

  amount: z.coerce
    .number()
    .min(0.01, 'Valor obrigatório'),

  category: z.string().default('geral'),
})

type CompanyForm = z.infer<typeof companySchema>

type FixedCostForm = z.infer<typeof fixedCostSchema>

/* =========================================================
   HELPERS
========================================================= */

function fmt(value: number) {
  return new Intl.NumberFormat(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL',
    }
  ).format(value)
}

/* =========================================================
   TOAST
========================================================= */

function SavedToast({
  visible,
}: {
  visible: boolean
}) {
  return (
    <div
      className={clsx(
        'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-modal',
        'bg-white dark:bg-surface-dark border border-success/20',
        'transition-all duration-300',
        visible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      )}
    >
      <div className="w-8 h-8 rounded-xl bg-success-light flex items-center justify-center">
        <CheckCircle
          size={16}
          className="text-success"
        />
      </div>

      <div>
        <p className="text-sm font-semibold text-text-primary dark:text-stone-100">
          Salvo com sucesso!
        </p>

        <p className="text-xs text-text-muted dark:text-stone-400">
          Dados atualizados.
        </p>
      </div>
    </div>
  )
}

/* =========================================================
   LABEL
========================================================= */

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
      {children}

      {required && (
        <span className="text-error ml-1">
          *
        </span>
      )}
    </label>
  )
}

/* =========================================================
   SECTION TITLE
========================================================= */

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border dark:border-border-dark">
      <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary/10">
        <Icon
          size={18}
          className="text-primary"
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">
          {title}
        </h3>

        {subtitle && (
          <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

/* =========================================================
   PAGE
========================================================= */

export default function ConfiguracoesPage() {
  const supabase = createClient()

  const queryClient = useQueryClient()

  const router = useRouter()

  const logoInputRef =
    useRef<HTMLInputElement>(null)

  const [tab, setTab] =
    useState<Tab>('empresa')

  const [userId, setUserId] =
    useState<string | null>(null)

  const [companyId, setCompanyId] =
    useState<string | null>(null)

  const [saved, setSaved] =
    useState(false)

  const [logoPreview, setLogoPreview] =
    useState<string | null>(null)

  const [uploadingLogo, setUploadingLogo] =
    useState(false)

  const [daysPerWeek, setDaysPerWeek] =
    useState(5)

  const [hoursPerDay, setHoursPerDay] =
    useState(8)

  const [weeksPerMonth, setWeeksPerMonth] =
    useState(4.3)

  const [prolabore, setProlabore] =
    useState(0)

  /* =========================================================
     LOAD USER
  ========================================================= */

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      setUserId(user.id)

      const { data: company } =
        await (
          supabase.from('companies') as any
        )
          .select('*')
          .eq('user_id', user.id)
          .single()

      if (company?.id) {
        setCompanyId(company.id)
      }
    }

    load()
  }, [])

  /* =========================================================
     QUERIES
  ========================================================= */

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],

    enabled: !!userId,

    queryFn: async () => {
      const { data } = await (
        supabase.from('profiles') as any
      )
        .select('*')
        .eq('id', userId!)
        .single()

      return data
    },
  })

  const { data: company } = useQuery({
    queryKey: ['company', userId],

    enabled: !!userId,

    queryFn: async () => {
      const { data } = await (
        supabase.from('companies') as any
      )
        .select('*')
        .eq('user_id', userId!)
        .single()

      return data
    },
  })

  const { data: fixedCosts } = useQuery({
    queryKey: ['fixed-costs', companyId],

    enabled: !!companyId,

    queryFn: async () => {
      const { data } = await (
        supabase.from('fixed_costs') as any
      )
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at')

      return data ?? []
    },
  })

  /* =========================================================
     FORMS
  ========================================================= */

  const coForm = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),

    defaultValues: {
      name: '',
      responsible_name: '',
      phone: '',
      instagram: '',
      city: '',
      state: '',
      email: '',
      work_hours_per_month: 160,
    },
  })

  const fcForm = useForm<FixedCostForm>({
    resolver: zodResolver(fixedCostSchema),

    defaultValues: {
      name: '',
      amount: 0,
      category: 'geral',
    },
  })

  /* =========================================================
     LOAD FORM DATA
  ========================================================= */

  useEffect(() => {
    if (!company) return

    const address =
      company.address || ''

    const parts = address.includes(',')
      ? address.split(',')
      : [address, '']

    coForm.reset({
      name: company.name || '',

      responsible_name:
        profile?.name || '',

      phone: company.phone || '',

      instagram: company.cnpj || '',

      city: parts[0]?.trim() || '',

      state: parts[1]?.trim() || '',

      email: company.email || '',

      work_hours_per_month:
        company.work_hours_per_month ||
        160,
    })

    if (company.logo_url) {
      setLogoPreview(company.logo_url)
    }
  }, [company, profile])

  /* =========================================================
     TOAST
  ========================================================= */

  function showSaved() {
    setSaved(true)

    setTimeout(() => {
      setSaved(false)
    }, 3000)
  }

  /* =========================================================
     SAVE COMPANY
  ========================================================= */

  const saveCompany = useMutation({
    mutationFn: async (
      data: CompanyForm
    ) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error(
          'Usuário não autenticado'
        )
      }

      const address =
        data.city && data.state
          ? `${data.city}, ${data.state}`
          : data.city ||
            data.state ||
            ''

      const payload = {
        user_id: user.id,

        name: data.name,

        phone: data.phone || null,

        email: data.email || null,

        cnpj: data.instagram || null,

        address,

        work_hours_per_month:
          data.work_hours_per_month,

        updated_at:
          new Date().toISOString(),
      }

      const {
        data: savedCompany,
        error,
      } = await (
        supabase.from(
          'companies'
        ) as any
      )
        .upsert([payload], {
          onConflict: 'user_id',
        })
        .select()
        .single()

      if (error) {
        console.error(error)

        throw error
      }

      if (savedCompany?.id) {
        setCompanyId(savedCompany.id)
      }

      if (data.responsible_name) {
        await (
          supabase.from(
            'profiles'
          ) as any
        )
          .update({
            name:
              data.responsible_name,

            updated_at:
              new Date().toISOString(),
          })
          .eq('id', user.id)
      }

      return savedCompany
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['company'],
      })

      queryClient.invalidateQueries({
        queryKey: ['profile'],
      })

      showSaved()
    },
  })

  /* =========================================================
     ADD COST
  ========================================================= */

  const addCost = useMutation({
    mutationFn: async (
      data: FixedCostForm
    ) => {
      if (!companyId) return

      const { error } = await (
        supabase.from(
          'fixed_costs'
        ) as any
      ).insert([
        {
          ...data,
          company_id: companyId,
        },
      ])

      if (error) {
        throw error
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['fixed-costs'],
      })

      fcForm.reset({
        name: '',
        amount: 0,
        category: 'geral',
      })

      showSaved()
    },
  })

  /* =========================================================
     DELETE COST
  ========================================================= */

  const deleteCost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (
        supabase.from(
          'fixed_costs'
        ) as any
      )
        .delete()
        .eq('id', id)

      if (error) {
        throw error
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['fixed-costs'],
      })

      showSaved()
    },
  })

  /* =========================================================
     LOGO UPLOAD
  ========================================================= */

  async function handleLogoUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      e.target.files?.[0]

    if (!file || !companyId) return

    setUploadingLogo(true)

    try {
      const ext =
        file.name.split('.').pop()

      const path = `logos/${companyId}.${ext}`

      const { error } =
        await supabase.storage
          .from('company-assets')
          .upload(path, file, {
            upsert: true,
          })

      if (error) {
        throw error
      }

      const { data } =
        supabase.storage
          .from('company-assets')
          .getPublicUrl(path)

      await (
        supabase.from(
          'companies'
        ) as any
      )
        .update({
          logo_url:
            data.publicUrl,
        })
        .eq('id', companyId)

      setLogoPreview(
        data.publicUrl
      )

      queryClient.invalidateQueries({
        queryKey: ['company'],
      })

      showSaved()
    } catch (err) {
      console.error(err)
    } finally {
      setUploadingLogo(false)
    }
  }

  /* =========================================================
     LOGOUT
  ========================================================= */

  async function handleLogout() {
    await supabase.auth.signOut()

    router.push('/login')
  }

  /* =========================================================
     RESET PASSWORD
  ========================================================= */

  async function handleResetPassword() {
    if (!profile?.email) return

    await supabase.auth.resetPasswordForEmail(
      profile.email,
      {
        redirectTo: `${window.location.origin}/nova-senha`,
      }
    )

    showSaved()
  }

  /* =========================================================
     COMPUTED
  ========================================================= */

  const totalFixedCosts =
    fixedCosts?.reduce(
      (
        sum: number,
        item: any
      ) =>
        sum +
        Number(item.amount),
      0
    ) ?? 0

  const hoursPerMonth =
    Math.round(
      daysPerWeek *
        hoursPerDay *
        weeksPerMonth
    )

  const costPerHour =
    hoursPerMonth > 0
      ? (totalFixedCosts +
          prolabore) /
        hoursPerMonth
      : 0

  /* =========================================================
     TABS
  ========================================================= */

  const tabs = [
    {
      id: 'empresa' as Tab,
      label: 'Empresa',
      icon: Building2,
    },

    {
      id: 'financeiro' as Tab,
      label: 'Custos',
      icon: DollarSign,
    },

    {
      id: 'conta' as Tab,
      label: 'Conta',
      icon: CreditCard,
    },
  ]

  /* =========================================================
     PAGE
  ========================================================= */

  return (
    <div className="page-enter min-h-screen bg-background dark:bg-background-dark">

      <Header
        title="Configurações"
        subtitle="Personalize seu sistema"
      />

      <div className="p-3 sm:p-5 lg:p-6 max-w-3xl mx-auto space-y-4">

        {/* TABS */}

        <div className="flex gap-1 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-2xl p-1.5">

          {tabs.map((tabItem) => {
            const Icon =
              tabItem.icon

            const active =
              tab === tabItem.id

            return (
              <button
                key={tabItem.id}
                onClick={() =>
                  setTab(tabItem.id)
                }
                className={clsx(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active
                    ? 'bg-primary text-white'
                    : 'text-text-secondary dark:text-stone-400'
                )}
              >
                <Icon size={15} />

                {tabItem.label}
              </button>
            )
          })}
        </div>

        {/* EMPRESA */}

        {tab === 'empresa' && (
          <form
            onSubmit={coForm.handleSubmit(
              (data) =>
                saveCompany.mutate(
                  data
                )
            )}
            className="space-y-4"
          >

            <div className="card">

              <SectionTitle
                icon={Building2}
                title="Dados da empresa"
                subtitle="Informações do negócio"
              />

              <div className="space-y-4">

                <div>

                  <FieldLabel required>
                    Nome da empresa
                  </FieldLabel>

                  <input
                    type="text"
                    placeholder="Nome da empresa"
                    className="input"
                    {...coForm.register(
                      'name'
                    )}
                  />

                </div>

                <div>

                  <FieldLabel>
                    Responsável
                  </FieldLabel>

                  <input
                    type="text"
                    placeholder="Seu nome"
                    className="input"
                    {...coForm.register(
                      'responsible_name'
                    )}
                  />

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div>

                    <FieldLabel>
                      WhatsApp
                    </FieldLabel>

                    <div className="relative">

                      <Phone
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                      />

                      <input
                        type="text"
                        className="input pl-9"
                        placeholder="41 99999-9999"
                        {...coForm.register(
                          'phone'
                        )}
                      />

                    </div>

                  </div>

                  <div>

                    <FieldLabel>
                      Instagram
                    </FieldLabel>

                    <div className="relative">

                      <Instagram
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                      />

                      <input
                        type="text"
                        className="input pl-9"
                        placeholder="@empresa"
                        {...coForm.register(
                          'instagram'
                        )}
                      />

                    </div>

                  </div>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div>

                    <FieldLabel>
                      Cidade
                    </FieldLabel>

                    <div className="relative">

                      <MapPin
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                      />

                      <input
                        type="text"
                        className="input pl-9"
                        placeholder="Curitiba"
                        {...coForm.register(
                          'city'
                        )}
                      />

                    </div>

                  </div>

                  <div>

                    <FieldLabel>
                      Estado
                    </FieldLabel>

                    <input
                      type="text"
                      maxLength={2}
                      className="input uppercase"
                      placeholder="PR"
                      {...coForm.register(
                        'state'
                      )}
                    />

                  </div>

                </div>

                <div>

                  <FieldLabel>
                    Logo
                  </FieldLabel>

                  <div
                    onClick={() =>
                      logoInputRef.current?.click()
                    }
                    className="cursor-pointer border-2 border-dashed border-border dark:border-border-dark rounded-2xl p-5 flex items-center gap-4 hover:border-primary transition-all"
                  >

                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="w-16 h-16 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                        {uploadingLogo ? (
                          <Loader2
                            size={20}
                            className="animate-spin text-primary"
                          />
                        ) : (
                          <Upload
                            size={20}
                            className="text-primary"
                          />
                        )}
                      </div>
                    )}

                    <div>

                      <p className="text-sm font-medium">
                        {logoPreview
                          ? 'Trocar logo'
                          : 'Enviar logo'}
                      </p>

                      <p className="text-xs text-text-muted">
                        PNG ou JPG
                      </p>

                    </div>

                    <input
                      ref={
                        logoInputRef
                      }
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={
                        handleLogoUpload
                      }
                    />

                  </div>

                </div>

                <button
                  type="submit"
                  disabled={
                    saveCompany.isPending
                  }
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >

                  {saveCompany.isPending ? (
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />
                  ) : (
                    <CheckCircle size={15} />
                  )}

                  {saveCompany.isPending
                    ? 'Salvando...'
                    : 'Salvar'}

                </button>

              </div>

            </div>

          </form>
        )}

      </div>

      <SavedToast visible={saved} />

    </div>
  )
}
