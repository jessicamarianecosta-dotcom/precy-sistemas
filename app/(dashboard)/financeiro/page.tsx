'use client'

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'

import { Header } from '@/components/layout/Header'

import { SkeletonTable } from '@/components/ui/Skeleton'

import { EmptyState } from '@/components/ui/EmptyState'

import { useToast } from '@/components/ui/Toaster'

import { useCompanyId } from '@/hooks/useCompanyId'

import {
  DollarSign,
  Plus,
  TrendingUp,
  TrendingDown,
  X,
  Loader2,
  Trash2,
  CalendarDays,
  BadgeDollarSign,
  Receipt,
} from 'lucide-react'

import { useForm } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'

import { z } from 'zod'

import { useState } from 'react'

import { clsx } from 'clsx'

import { format } from 'date-fns'

/* ─────────────────────────────────────────────
   Schema
───────────────────────────────────────────── */

const schema = z.object({
  type: z.enum([
    'income',
    'expense',
  ]),

  category: z
    .string()
    .min(
      1,
      'Categoria obrigatória'
    ),

  amount: z.coerce
    .number()
    .min(
      0.01,
      'Valor deve ser maior que 0'
    ),

  description: z.string().optional(),

  date: z.string(),
})

type FormData = z.infer<typeof schema>

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function fmt(v: number) {
  return new Intl.NumberFormat(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL',
    }
  ).format(v)
}

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */

export default function FinanceiroPage() {
  const supabase = createClient()

  const qc = useQueryClient()

  const { toast } = useToast()

  const {
    companyId,
    userId,
  } = useCompanyId()

  const [showModal, setShowModal] =
    useState(false)

  const [deleteId, setDeleteId] =
    useState<string | null>(null)

  const [filterType, setFilterType] =
    useState('all')

  /* ─────────────────────────────────────────────
     Query
  ───────────────────────────────────────────── */

  const {
    data: transactions,
    isLoading,
  } = useQuery({
    queryKey: [
      'transactions',
      companyId,
    ],

    enabled:
      !!companyId && !!userId,

    queryFn: async () => {
      const { data, error } =
        await (
          supabase.from(
            'transactions'
          ) as any
        )
          .select('*')
          .eq(
            'company_id',
            companyId!
          )
          .order('date', {
            ascending: false,
          })

      if (error) throw error

      return data ?? []
    },
  })

  /* ─────────────────────────────────────────────
     Form
  ───────────────────────────────────────────── */

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver:
      zodResolver(schema),

    defaultValues: {
      type: 'income',

      date: format(
        new Date(),
        'yyyy-MM-dd'
      ),

      category: 'vendas',
    },
  })

  const currentType =
    watch('type')

  /* ─────────────────────────────────────────────
     Save
  ───────────────────────────────────────────── */

  const saveMutation = useMutation({
    mutationFn: async (
      d: FormData
    ) => {
      if (!companyId)
        throw new Error(
          'Empresa não encontrada'
        )

      if (!userId)
        throw new Error(
          'Usuário não autenticado'
        )

      const { error } = await (
        supabase.from(
          'transactions'
        ) as any
      )
        .insert([
          {
            ...d,

            company_id:
              companyId,

            user_id: userId,
          },
        ])
        .select()

      if (error) throw error
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [
          'transactions',
          companyId,
        ],
      })

      qc.invalidateQueries({
        queryKey: [
          'dashboard',
          companyId,
        ],
      })

      toast(
        'success',
        'Transação registrada!'
      )

      setShowModal(false)

      reset({
        type: 'income',

        date: format(
          new Date(),
          'yyyy-MM-dd'
        ),

        category: 'vendas',
      })
    },

    onError: (err: Error) => {
      console.error(
        '[financeiro] save error:',
        err
      )

      toast(
        'error',
        `Erro ao registrar: ${err.message}`
      )
    },
  })

  /* ─────────────────────────────────────────────
     Delete
  ───────────────────────────────────────────── */

  const deleteMutation = useMutation({
    mutationFn: async (
      id: string
    ) => {
      const { error } = await (
        supabase.from(
          'transactions'
        ) as any
      )
        .delete()
        .eq('id', id)

      if (error) throw error
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [
          'transactions',
          companyId,
        ],
      })

      qc.invalidateQueries({
        queryKey: [
          'dashboard',
          companyId,
        ],
      })

      toast(
        'success',
        'Transação removida.'
      )

      setDeleteId(null)
    },

    onError: (err: Error) => {
      console.error(
        '[financeiro] delete error:',
        err
      )

      toast(
        'error',
        `Erro ao excluir: ${err.message}`
      )
    },
  })

  /* ─────────────────────────────────────────────
     Computed
  ───────────────────────────────────────────── */

  const totalIncome =
    (transactions ?? [])
      .filter(
        (
          t: Record<
            string,
            unknown
          >
        ) =>
          t.type === 'income'
      )
      .reduce(
        (
          s: number,
          t: Record<
            string,
            unknown
          >
        ) =>
          s + Number(t.amount),
        0
      )

  const totalExpense =
    (transactions ?? [])
      .filter(
        (
          t: Record<
            string,
            unknown
          >
        ) =>
          t.type === 'expense'
      )
      .reduce(
        (
          s: number,
          t: Record<
            string,
            unknown
          >
        ) =>
          s + Number(t.amount),
        0
      )

  const balance =
    totalIncome - totalExpense

  const filtered =
    (transactions ?? []).filter(
      (
        t: Record<
          string,
          unknown
        >
      ) =>
        filterType === 'all' ||
        t.type === filterType
    )

  /* ─────────────────────────────────────────────
     Render
  ───────────────────────────────────────────── */

  return (
    <div className="page-enter">

      <Header
        title="Financeiro"
        subtitle="Controle de receitas e despesas"
      />

      <div className="p-4 sm:p-6 space-y-4">

        {/* Summary */}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          {[
            {
              label: 'Receitas',

              value: totalIncome,

              icon: TrendingUp,

              color: 'text-success',

              bg: 'bg-success-light dark:bg-success/10',
            },

            {
              label: 'Despesas',

              value: totalExpense,

              icon: TrendingDown,

              color: 'text-error',

              bg: 'bg-error-light dark:bg-error/10',
            },

            {
              label: 'Saldo',

              value: balance,

              icon: DollarSign,

              color:
                balance >= 0
                  ? 'text-success'
                  : 'text-error',

              bg:
                balance >= 0
                  ? 'bg-success-light dark:bg-success/10'
                  : 'bg-error-light dark:bg-error/10',
            },
          ].map((card) => {
            const Icon =
              card.icon

            return (
              <div
                key={card.label}
                className="card flex items-center gap-4 p-4"
              >
                <div
                  className={clsx(
                    'p-3 rounded-2xl flex-shrink-0',
                    card.bg
                  )}
                >
                  <Icon
                    size={22}
                    className={
                      card.color
                    }
                  />
                </div>

                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    {card.label}
                  </p>

                  <p
                    className={clsx(
                      'text-2xl font-bold',
                      card.color
                    )}
                  >
                    {fmt(
                      card.value
                    )}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Toolbar */}

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">

          <div className="flex gap-2 flex-wrap">

            {[
              {
                v: 'all',
                l: 'Todos',
              },

              {
                v: 'income',
                l: 'Receitas',
              },

              {
                v: 'expense',
                l: 'Despesas',
              },
            ].map((btn) => (
              <button
                key={btn.v}
                onClick={() =>
                  setFilterType(
                    btn.v
                  )
                }
                className={clsx(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all',

                  filterType ===
                    btn.v
                    ? 'bg-primary text-white shadow-md'
                    : 'text-text-secondary hover:bg-primary-50 dark:hover:bg-white/5'
                )}
              >
                {btn.l}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              reset({
                type:
                  'income',

                date: format(
                  new Date(),
                  'yyyy-MM-dd'
                ),

                category:
                  'vendas',
              })

              setShowModal(
                true
              )
            }}
            className="btn-primary flex items-center gap-2 w-full sm:w-auto"
          >
            <Plus size={16} />
            Nova Transação
          </button>
        </div>

        {/* Table */}

        <div className="card p-0 overflow-hidden">

          {isLoading ? (
            <div className="p-6">
              <SkeletonTable rows={6} />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={
                DollarSign
              }
              title="Sem transações"
              description="Registre receitas e despesas para controlar suas finanças."
              action={{
                label:
                  '+ Nova Transação',

                onClick: () =>
                  setShowModal(
                    true
                  ),
              }}
            />
          ) : (
            <>
              {/* ── MOBILE: cards ── */}
              <div className="md:hidden divide-y divide-border dark:divide-border-dark">
                {filtered.map((t: Record<string, unknown>) => (
                  <div key={t.id as string} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={clsx(
                        'w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0',
                        t.type === 'income'
                          ? 'bg-success-light dark:bg-success/10'
                          : 'bg-error-light dark:bg-error/10'
                      )}>
                        {t.type === 'income'
                          ? <TrendingUp size={16} className="text-success" />
                          : <TrendingDown size={16} className="text-error" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">
                              {(t.description as string) || (t.type === 'income' ? 'Receita' : 'Despesa')}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="badge badge-primary text-[10px]">{t.category as string}</span>
                              <span className="text-[10px] text-text-muted">
                                {new Date(t.date as string).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>
                          <span className={clsx(
                            'text-sm font-bold flex-shrink-0',
                            t.type === 'income' ? 'text-success' : 'text-error'
                          )}>
                            {t.type === 'income' ? '+' : '-'}
                            {new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(t.amount))}
                          </span>
                        </div>
                        <div className="flex justify-end mt-2">
                          <button onClick={() => setDeleteId(t.id as string)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── DESKTOP: tabela ── */}
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full">

                <thead>
                  <tr className="border-b border-border dark:border-border-dark">

                    {[
                      'Tipo',
                      'Descrição',
                      'Categoria',
                      'Data',
                      'Valor',
                      '',
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider p-4"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>

                  {filtered.map(
                    (
                      t: Record<
                        string,
                        unknown
                      >
                    ) => (
                      <tr
                        key={
                          t.id as string
                        }
                        className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/30 dark:hover:bg-white/[0.02] transition-colors"
                      >

                        <td className="p-4">

                          <div
                            className={clsx(
                              'w-10 h-10 rounded-2xl flex items-center justify-center',

                              t.type ===
                                'income'
                                ? 'bg-success-light dark:bg-success/10'
                                : 'bg-error-light dark:bg-error/10'
                            )}
                          >
                            {t.type ===
                            'income' ? (
                              <TrendingUp
                                size={
                                  16
                                }
                                className="text-success"
                              />
                            ) : (
                              <TrendingDown
                                size={
                                  16
                                }
                                className="text-error"
                              />
                            )}
                          </div>
                        </td>

                        <td className="p-4">

                          <p className="text-sm font-semibold text-text-primary dark:text-stone-100">

                            {(t.description as string) ||
                              (t.type ===
                              'income'
                                ? 'Receita'
                                : 'Despesa')}
                          </p>
                        </td>

                        <td className="p-4">

                          <span className="badge badge-primary">
                            {
                              t.category as string
                            }
                          </span>
                        </td>

                        <td className="p-4 text-sm text-text-secondary dark:text-stone-300">

                          {format(
                            new Date(
                              t.date as string
                            ),
                            'dd/MM/yyyy'
                          )}
                        </td>

                        <td className="p-4">

                          <span
                            className={clsx(
                              'text-sm font-bold',

                              t.type ===
                                'income'
                                ? 'text-success'
                                : 'text-error'
                            )}
                          >
                            {t.type ===
                            'income'
                              ? '+'
                              : '-'}

                            {fmt(
                              Number(
                                t.amount
                              )
                            )}
                          </span>
                        </td>

                        <td className="p-4">

                          <button
                            onClick={() =>
                              setDeleteId(
                                t.id as string
                              )
                            }
                            className="p-2 rounded-xl text-text-muted hover:text-error hover:bg-error-light transition-colors"
                          >
                            <Trash2
                              size={
                                15
                              }
                            />
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>

      {/* Modal */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() =>
              setShowModal(
                false
              )
            }
          />

          <div className="relative bg-white dark:bg-surface-dark rounded-3xl shadow-modal w-full max-w-lg animate-scaleIn max-h-[92vh] overflow-y-auto">

            {/* Header */}

            <div className="p-4 sm:p-6 border-b border-border dark:border-border-dark flex items-center justify-between">

              <div>
                <h2 className="text-2xl font-bold text-text-primary dark:text-stone-100">
                  Nova Transação
                </h2>

                <p className="text-sm text-text-muted mt-1">
                  Registre entradas e saídas financeiras
                </p>
              </div>

              <button
                onClick={() =>
                  setShowModal(
                    false
                  )
                }
                className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}

            <form
              onSubmit={handleSubmit(
                (d) =>
                  saveMutation.mutate(
                    d
                  )
              )}
              className="p-4 sm:p-6 space-y-5"
            >

              {/* Tipo */}

              <div className="space-y-2">

                <label className="text-sm font-semibold flex items-center gap-2">
                  <BadgeDollarSign
                    size={14}
                  />
                  Tipo
                </label>

                <select
                  className="input h-12"
                  {...register(
                    'type'
                  )}
                >
                  <option value="income">
                    Receita
                  </option>

                  <option value="expense">
                    Despesa
                  </option>
                </select>
              </div>

              {/* Categoria */}

              <div className="space-y-2">

                <label className="text-sm font-semibold flex items-center gap-2">
                  <Receipt
                    size={14}
                  />
                  Categoria
                </label>

                <input
                  className="input h-12"
                  placeholder="Ex: vendas, fornecedores..."
                  {...register(
                    'category'
                  )}
                />

                {errors.category && (
                  <p className="text-xs text-error">
                    {
                      errors
                        .category
                        .message
                    }
                  </p>
                )}
              </div>

              {/* Valor */}

              <div className="space-y-2">

                <label className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign
                    size={14}
                  />
                  Valor (R$)
                </label>

                <input
                  type="number"
                  step="0.01"
                  className={clsx(
                    'input h-12 font-semibold',

                    currentType ===
                      'income'
                      ? 'text-success'
                      : 'text-error'
                  )}
                  placeholder="0,00"
                  {...register(
                    'amount'
                  )}
                />

                {errors.amount && (
                  <p className="text-xs text-error">
                    {
                      errors
                        .amount
                        .message
                    }
                  </p>
                )}
              </div>

              {/* Data */}

              <div className="space-y-2">

                <label className="text-sm font-semibold flex items-center gap-2">
                  <CalendarDays
                    size={14}
                  />
                  Data
                </label>

                <input
                  type="date"
                  className="input h-12"
                  {...register(
                    'date'
                  )}
                />
              </div>

              {/* Descrição */}

              <div className="space-y-2">

                <label className="text-sm font-semibold">
                  Descrição
                </label>

                <textarea
                  rows={3}
                  className="input resize-none"
                  placeholder="Detalhes adicionais..."
                  {...register(
                    'description'
                  )}
                />
              </div>

              {/* Footer */}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">

                <button
                  type="button"
                  onClick={() =>
                    setShowModal(
                      false
                    )
                  }
                  className="btn-secondary flex-1 h-12"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    saveMutation.isPending
                  }
                  className="btn-primary flex-1 h-12 flex items-center justify-center gap-2"
                >
                  {saveMutation.isPending && (
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />
                  )}

                  {saveMutation.isPending
                    ? 'Salvando...'
                    : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete */}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() =>
              setDeleteId(null)
            }
          />

          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm animate-scaleIn p-6 text-center">

            <div className="w-12 h-12 rounded-2xl bg-error-light flex items-center justify-center mx-auto mb-4">

              <Trash2
                size={20}
                className="text-error"
              />
            </div>

            <h3 className="text-base font-semibold mb-2 text-text-primary dark:text-stone-100">
              Excluir transação?
            </h3>

            <p className="text-sm text-text-secondary dark:text-stone-400 mb-6">
              Esta ação não pode ser desfeita.
            </p>

            <div className="flex gap-3">

              <button
                onClick={() =>
                  setDeleteId(null)
                }
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>

              <button
                onClick={() =>
                  deleteMutation.mutate(
                    deleteId!
                  )
                }
                disabled={
                  deleteMutation.isPending
                }
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-error hover:opacity-90 disabled:opacity-50"
              >
                {deleteMutation.isPending && (
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                )}

                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
