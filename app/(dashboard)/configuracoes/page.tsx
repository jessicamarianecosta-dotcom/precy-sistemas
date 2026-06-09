'use client'

import { useEffect, useState, useRef } from 'react'
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

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
  Upload,
  Instagram,
  Phone,
  MapPin,
  Clock,
  TrendingUp,
} from 'lucide-react'

import { clsx } from 'clsx'

import { useForm } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'

import { z } from 'zod'

import { useRouter } from 'next/navigation'

type Tab =
  | 'empresa'
  | 'financeiro'
  | 'conta'

const companySchema = z.object({
  name: z.string().min(2),

  responsible_name:
    z.string().optional(),

  phone:
    z.string().optional(),

  instagram:
    z.string().optional(),

  city:
    z.string().optional(),

  state:
    z.string().optional(),

  email: z
    .string()
    .email()
    .optional()
    .or(z.literal('')),

  work_hours_per_month:
    z.coerce.number(),
})

const fixedCostSchema = z.object({
  name: z.string().min(2),

  amount:
    z.coerce.number(),

  category:
    z.string(),
})

type CompanyForm =
  z.infer<typeof companySchema>

type FixedCostForm =
  z.infer<typeof fixedCostSchema>

function fmt(value: number) {
  return new Intl.NumberFormat(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL',
    }
  ).format(value)
}

function SavedToast({
  visible,
}: {
  visible: boolean
}) {
  return (
    <div
      className={clsx(
        'fixed bottom-6 right-6 z-50 transition-all',
        visible
          ? 'opacity-100'
          : 'opacity-0 pointer-events-none'
      )}
    >
      <div className="bg-green-500 text-white px-5 py-3 rounded-2xl shadow-xl">
        Salvo com sucesso
      </div>
    </div>
  )
}

export default function ConfiguracoesPage() {

  const supabase =
    createClient()

  const queryClient =
    useQueryClient()

  const router =
    useRouter()

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

  const coForm =
    useForm<CompanyForm>({
      resolver:
        zodResolver(
          companySchema
        ),

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

  const fcForm =
    useForm<FixedCostForm>({
      resolver:
        zodResolver(
          fixedCostSchema
        ),

      defaultValues: {
        name: '',
        amount: 0,
        category: 'geral',
      },
    })

  useEffect(() => {
    async function load() {

      const {
        data: { user },
      } =
        await supabase.auth.getUser()

      if (!user) return

      setUserId(user.id)

      const { data } =
        await (
          supabase.from(
            'companies'
          ) as any
        )
          .select('*')
          .eq(
            'user_id',
            user.id
          )
          .single()

      if (data?.id) {

        setCompanyId(data.id)

        setDaysPerWeek(
          Number(
            data.days_per_week || 5
          )
        )

        setHoursPerDay(
          Number(
            data.hours_per_day || 8
          )
        )

        setWeeksPerMonth(
          Number(
            data.weeks_per_month || 4.3
          )
        )

        setProlabore(
          Number(
            data.prolabore || 0
          )
        )

        coForm.reset({
          name:
            data.name || '',

          responsible_name:
            data.responsible_name || '',

          phone:
            data.phone || '',

          instagram:
            data.cnpj || '',

          city:
            data.address || '',

          state: '',

          email:
            data.email || '',

          work_hours_per_month:
            data.work_hours_per_month || 160,
        })

        if (data.logo_url) {
          setLogoPreview(
            data.logo_url
          )
        }
      }
    }

    load()
  }, [])

  const {
    data: fixedCosts,
  } = useQuery({
    queryKey: [
      'fixed-costs',
      companyId,
    ],

    enabled:
      !!companyId,

    queryFn: async () => {

      const { data } =
        await (
          supabase.from(
            'fixed_costs'
          ) as any
        )
          .select('*')
          .eq(
            'company_id',
            companyId!
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          )

      return data || []
    },
  })

  function showSaved() {

    setSaved(true)

    setTimeout(() => {
      setSaved(false)
    }, 2500)
  }

  const saveCompany =
    useMutation({

      mutationFn:
        async (
          data: CompanyForm
        ) => {

          const {
            data: { user },
          } =
            await supabase.auth.getUser()

          if (!user) {
            throw new Error(
              'Usuário não autenticado'
            )
          }

          const payload = {

            user_id:
              user.id,

            name:
              data.name,

            responsible_name:
              data.responsible_name,

            phone:
              data.phone,

            cnpj:
              data.instagram,

            address:
              data.city,

            email:
              data.email,

            work_hours_per_month:
              data.work_hours_per_month,

            days_per_week:
              daysPerWeek,

            hours_per_day:
              hoursPerDay,

            weeks_per_month:
              weeksPerMonth,

            prolabore:
              prolabore,

            updated_at:
              new Date().toISOString(),
          }

          const {
            data: savedCompany,
            error,
          } =
            await (
              supabase.from(
                'companies'
              ) as any
            )
              .upsert(
                [payload],
                {
                  onConflict:
                    'user_id',
                }
              )
              .select()
              .single()

          if (error) {
            throw error
          }

          if (
            savedCompany?.id
          ) {
            setCompanyId(
              savedCompany.id
            )
          }

          return savedCompany
        },

      onSuccess: () => {

        queryClient.invalidateQueries({
          queryKey: [
            'company',
          ],
        })

        showSaved()
      },
    })

  const addCost =
    useMutation({

      mutationFn:
        async (
          data: FixedCostForm
        ) => {

          if (!companyId) {
            throw new Error(
              'Empresa não encontrada'
            )
          }

          const { error } =
            await (
              supabase.from(
                'fixed_costs'
              ) as any
            ).insert([
              {
                company_id:
                  companyId,

                name:
                  data.name,

                amount:
                  data.amount,

                category:
                  data.category,
              },
            ])

          if (error) {
            throw error
          }
        },

      onSuccess: () => {

        queryClient.invalidateQueries({
          queryKey: [
            'fixed-costs',
          ],
        })

        fcForm.reset()

        showSaved()
      },
    })

  const deleteCost =
    useMutation({

      mutationFn:
        async (
          id: string
        ) => {

          const { error } =
            await (
              supabase.from(
                'fixed_costs'
              ) as any
            )
              .delete()
              .eq(
                'id',
                id
              )

          if (error) {
            throw error
          }
        },

      onSuccess: () => {

        queryClient.invalidateQueries({
          queryKey: [
            'fixed-costs',
          ],
        })

        showSaved()
      },
    })

  async function handleLogoUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {

    const file =
      e.target.files?.[0]

    if (
      !file ||
      !companyId
    ) return

    setUploadingLogo(true)

    try {

      const ext =
        file.name
          .split('.')
          .pop()

      const path =
        `logos/${companyId}.${ext}`

      const { error } =
        await supabase.storage
          .from(
            'company-assets'
          )
          .upload(
            path,
            file,
            {
              upsert: true,
            }
          )

      if (error) {
        throw error
      }

      const { data } =
        supabase.storage
          .from(
            'company-assets'
          )
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
        .eq(
          'id',
          companyId
        )

      setLogoPreview(
        data.publicUrl
      )

      showSaved()

    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleLogout() {

    await supabase.auth.signOut()

    router.push('/login')
  }

  const totalFixedCosts =
    fixedCosts?.reduce(
      (
        sum: number,
        item: any
      ) =>
        sum +
        Number(
          item.amount
        ),
      0
    ) || 0

  const hoursPerMonth =
    Math.round(
      daysPerWeek *
        hoursPerDay *
        weeksPerMonth
    )

  const costPerHour =
    hoursPerMonth > 0
      ? (
          totalFixedCosts +
          prolabore
        ) /
        hoursPerMonth
      : 0

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark">

      <Header
        title="Configurações"
        subtitle="Personalize seu sistema"
      />

      <div className="max-w-5xl mx-auto p-4 space-y-5">

        <div className="flex gap-2">

          <button
            onClick={() =>
              setTab(
                'empresa'
              )
            }
            className={clsx(
              'px-5 py-2 rounded-xl',
              tab ===
                'empresa'
                ? 'bg-primary text-white'
                : 'bg-card'
            )}
          >
            Empresa
          </button>

          <button
            onClick={() =>
              setTab(
                'financeiro'
              )
            }
            className={clsx(
              'px-5 py-2 rounded-xl',
              tab ===
                'financeiro'
                ? 'bg-primary text-white'
                : 'bg-card'
            )}
          >
            Custos Fixos
          </button>

          <button
            onClick={() =>
              setTab(
                'conta'
              )
            }
            className={clsx(
              'px-5 py-2 rounded-xl',
              tab ===
                'conta'
                ? 'bg-primary text-white'
                : 'bg-card'
            )}
          >
            Conta
          </button>

        </div>

        {tab ===
          'empresa' && (

          <form
            onSubmit={coForm.handleSubmit(
              (
                data
              ) =>
                saveCompany.mutate(
                  data
                )
            )}
            className="space-y-4"
          >

            <div className="card p-5 space-y-4">

              <h2 className="text-xl font-bold">
                Empresa
              </h2>

              <input
                className="input"
                placeholder="Nome da empresa"
                {...coForm.register(
                  'name'
                )}
              />

              <input
                className="input"
                placeholder="Responsável"
                {...coForm.register(
                  'responsible_name'
                )}
              />

              <input
                className="input"
                placeholder="WhatsApp"
                {...coForm.register(
                  'phone'
                )}
              />

              <input
                className="input"
                placeholder="Instagram"
                {...coForm.register(
                  'instagram'
                )}
              />

              <input
                className="input"
                placeholder="Cidade"
                {...coForm.register(
                  'city'
                )}
              />

              <input
                className="input"
                placeholder="E-mail"
                {...coForm.register(
                  'email'
                )}
              />

              <div
                onClick={() =>
                  logoInputRef.current?.click()
                }
                className="border border-dashed rounded-xl p-5 cursor-pointer"
              >

                {uploadingLogo
                  ? 'Enviando...'
                  : logoPreview
                  ? 'Trocar logo'
                  : 'Enviar logo'}

              </div>

              <input
                ref={
                  logoInputRef
                }
                type="file"
                className="hidden"
                onChange={
                  handleLogoUpload
                }
              />

              <button
                type="submit"
                className="btn-primary w-full"
              >
                Salvar empresa
              </button>

            </div>

          </form>
        )}

        {tab ===
          'financeiro' && (

          <div className="space-y-5">

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <div className="card p-5">
                <p className="text-sm opacity-70">
                  Custos Fixos
                </p>

                <h2 className="text-2xl font-bold">
                  {fmt(
                    totalFixedCosts
                  )}
                </h2>
              </div>

              <div className="card p-5">
                <p className="text-sm opacity-70">
                  Horas/mês
                </p>

                <h2 className="text-2xl font-bold">
                  {
                    hoursPerMonth
                  }
                  h
                </h2>
              </div>

              <div className="card p-5">
                <p className="text-sm opacity-70">
                  Custo/hora
                </p>

                <h2 className="text-2xl font-bold">
                  {fmt(
                    costPerHour
                  )}
                </h2>
              </div>

            </div>

            <div className="card p-5 space-y-4">

              <h2 className="text-xl font-bold">
                Rotina de trabalho
              </h2>

              <div className="grid grid-cols-2 gap-4">

                <input
                  type="number"
                  className="input"
                  value={
                    daysPerWeek
                  }
                  onChange={(
                    e
                  ) =>
                    setDaysPerWeek(
                      Number(
                        e.target
                          .value
                      )
                    )
                  }
                  placeholder="Dias"
                />

                <input
                  type="number"
                  className="input"
                  value={
                    hoursPerDay
                  }
                  onChange={(
                    e
                  ) =>
                    setHoursPerDay(
                      Number(
                        e.target
                          .value
                      )
                    )
                  }
                  placeholder="Horas"
                />

                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={
                    weeksPerMonth
                  }
                  onChange={(
                    e
                  ) =>
                    setWeeksPerMonth(
                      Number(
                        e.target
                          .value
                      )
                    )
                  }
                  placeholder="Semanas"
                />

                <input
                  type="number"
                  className="input"
                  value={
                    prolabore
                  }
                  onChange={(
                    e
                  ) =>
                    setProlabore(
                      Number(
                        e.target
                          .value
                      )
                    )
                  }
                  placeholder="Pró-labore"
                />

              </div>

              <button
                onClick={() => {

                  const data =
                    coForm.getValues()

                  saveCompany.mutate(
                    data
                  )
                }}
                className="btn-primary"
              >
                Salvar rotina
              </button>

            </div>

            <div className="card p-5 space-y-4">

              <h2 className="text-xl font-bold">
                Custos Fixos
              </h2>

              <form
                onSubmit={fcForm.handleSubmit(
                  (
                    data
                  ) =>
                    addCost.mutate(
                      data
                    )
                )}
                className="grid grid-cols-1 md:grid-cols-4 gap-3"
              >

                <input
                  className="input"
                  placeholder="Nome"
                  {...fcForm.register(
                    'name'
                  )}
                />

                <input
                  type="number"
                  className="input"
                  placeholder="Valor"
                  {...fcForm.register(
                    'amount'
                  )}
                />

                <select
                  className="input"
                  {...fcForm.register(
                    'category'
                  )}
                >
                  <option value="geral">
                    Geral
                  </option>

                  <option value="energia">
                    Energia
                  </option>

                  <option value="agua">
                    Água
                  </option>

                  <option value="internet">
                    Internet
                  </option>

                </select>

                <button
                  type="submit"
                  className="btn-primary"
                >
                  Adicionar
                </button>

              </form>

              <div className="space-y-3">

                {fixedCosts?.map(
                  (
                    item: any
                  ) => (

                    <div
                      key={
                        item.id
                      }
                      className="flex items-center justify-between border rounded-xl p-4"
                    >

                      <div>

                        <p className="font-medium">
                          {
                            item.name
                          }
                        </p>

                        <p className="text-sm opacity-60">
                          {
                            item.category
                          }
                        </p>

                      </div>

                      <div className="flex items-center gap-3">

                        <span className="font-semibold">
                          {fmt(
                            Number(
                              item.amount
                            )
                          )}
                        </span>

                        <button
                          onClick={() =>
                            deleteCost.mutate(
                              item.id
                            )
                          }
                        >
                          <Trash2
                            size={
                              16
                            }
                          />
                        </button>

                      </div>

                    </div>
                  )
                )}

              </div>

            </div>

          </div>
        )}

        {tab ===
          'conta' && (

          <div className="card p-5 space-y-4">

            <h2 className="text-xl font-bold">
              Conta
            </h2>

            <button
              onClick={
                handleLogout
              }
              className="btn-danger"
            >
              <LogOut
                size={16}
              />

              Sair
            </button>

          </div>
        )}

      </div>

      <SavedToast
        visible={saved}
      />

    </div>
  )
}
