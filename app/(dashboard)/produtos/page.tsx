'use client'

import { useEffect, useState } from 'react'
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Loader2,
} from 'lucide-react'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { clsx } from 'clsx'

const productSchema = z.object({
  name: z.string().min(
    2,
    'Nome obrigatório'
  ),

  description: z.string().optional(),

  category: z.string().min(
    1,
    'Categoria obrigatória'
  ),

  unit: z.string().default('un'),

  production_time_hours:
    z.coerce.number().min(0),

  material_cost:
    z.coerce.number().min(0),

  markup_percentage:
    z.coerce.number().min(0),

  final_price:
    z.coerce.number().min(0),
})

type ProductForm = z.infer<
  typeof productSchema
>

function formatCurrency(
  value: number
) {
  return new Intl.NumberFormat(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL',
    }
  ).format(value)
}

export default function ProdutosPage() {
  const supabase = createClient()

  const queryClient =
    useQueryClient()

  const [companyId, setCompanyId] =
    useState<string | null>(null)

  const [showModal, setShowModal] =
    useState(false)

  const [editingId, setEditingId] =
    useState<string | null>(null)

  const [search, setSearch] =
    useState('')

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const response: any =
        await supabase
          .from('companies')
          .select('id')
          .eq('user_id', user.id)
          .single()

      const company =
        response?.data

      if (company?.id) {
        setCompanyId(company.id)
      }
    }

    load()
  }, [])

  const {
    data: products,
    isLoading,
  } = useQuery({
    queryKey: [
      'products',
      companyId,
    ],

    enabled: !!companyId,

    queryFn: async () => {
      const response: any =
        await supabase
          .from('products')
          .select('*')
          .eq(
            'company_id',
            companyId!
          )
          .order('created_at', {
            ascending: false,
          })

      return response?.data ?? []
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver:
      zodResolver(productSchema),

    defaultValues: {
      unit: 'un',

      markup_percentage: 100,

      production_time_hours: 1,

      material_cost: 0,

      final_price: 0,
    },
  })

  const saveMutation =
    useMutation({
      mutationFn: async (
        data: ProductForm
      ) => {
        if (editingId) {
          await (
            supabase.from(
              'products'
            ) as any
          )
            .update({
              ...data,

              updated_at:
                new Date().toISOString(),
            })
            .eq('id', editingId)
        } else {
          await (
            supabase.from(
              'products'
            ) as any
          ).insert([
            {
              ...data,

              company_id:
                companyId!,
            },
          ])
        }
      },

      onSuccess: () => {
        queryClient.invalidateQueries(
          {
            queryKey: [
              'products',
              companyId,
            ],
          }
        )

        queryClient.invalidateQueries(
          {
            queryKey: [
              'dashboard',
              companyId,
            ],
          }
        )

        setShowModal(false)

        reset()

        setEditingId(null)
      },
    })

  const deleteMutation =
    useMutation({
      mutationFn: async (
        id: string
      ) => {
        await (
          supabase.from(
            'products'
          ) as any
        )
          .delete()
          .eq('id', id)
      },

      onSuccess: () => {
        queryClient.invalidateQueries(
          {
            queryKey: [
              'products',
              companyId,
            ],
          }
        )
      },
    })

  function openEdit(
    product: Record<
      string,
      unknown
    >
  ) {
    setEditingId(
      product.id as string
    )

    Object.entries(product).forEach(
      ([k, v]) =>
        setValue(
          k as keyof ProductForm,
          v as never
        )
    )

    setShowModal(true)
  }

  const filtered =
    products?.filter(
      (p: any) =>
        p.name
          .toLowerCase()
          .includes(
            search.toLowerCase()
          ) ||
        p.category
          .toLowerCase()
          .includes(
            search.toLowerCase()
          )
    ) ?? []

  return (
    <div className="page-enter">
      <Header
        title="Produtos"
        subtitle="Gerencie seu catálogo de produtos"
      />

      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />

            <input
              type="text"
              placeholder="Buscar produtos..."
              className="input pl-9"
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
            />
          </div>

          <button
            onClick={() => {
              reset()

              setEditingId(null)

              setShowModal(true)
            }}
            className="btn-primary flex items-center gap-2 flex-shrink-0"
          >
            <Plus size={16} />
            Novo Produto
          </button>
        </div>

        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-6">
              <SkeletonTable rows={5} />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum produto cadastrado"
              description="Cadastre seus produtos e comece a precificar com inteligência."
              action={{
                label:
                  '+ Novo Produto',

                onClick: () =>
                  setShowModal(
                    true
                  ),
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border dark:border-border-dark">
                    <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider p-4">
                      Produto
                    </th>

                    <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider p-4">
                      Categoria
                    </th>

                    <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider p-4">
                      Custo
                    </th>

                    <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider p-4">
                      Margem
                    </th>

                    <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider p-4">
                      Preço Final
                    </th>

                    <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider p-4">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(
                    (product: any) => (
                      <tr
                        key={
                          product.id
                        }
                        className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/30 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Package
                                size={15}
                                className="text-primary"
                              />
                            </div>

                            <div>
                              <p className="text-sm font-medium text-text-primary dark:text-stone-100">
                                {
                                  product.name
                                }
                              </p>

                              <p className="text-xs text-text-muted dark:text-stone-500">
                                {
                                  product.unit
                                }{' '}
                                ·{' '}
                                {
                                  product.production_time_hours
                                }
                                h produção
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <span className="badge badge-primary">
                            {
                              product.category
                            }
                          </span>
                        </td>

                        <td className="p-4 text-right text-sm text-text-secondary dark:text-stone-300">
                          {formatCurrency(
                            product.material_cost
                          )}
                        </td>

                        <td className="p-4 text-right text-sm text-text-secondary dark:text-stone-300">
                          {
                            product.markup_percentage
                          }
                          %
                        </td>

                        <td className="p-4 text-right">
                          <span className="text-sm font-bold text-primary">
                            {formatCurrency(
                              product.final_price
                            )}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() =>
                                openEdit(
                                  product
                                )
                              }
                              className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-primary/10 transition-colors"
                            >
                              <Edit2
                                size={14}
                              />
                            </button>

                            <button
                              onClick={() =>
                                deleteMutation.mutate(
                                  product.id
                                )
                              }
                              className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"
                            >
                              <Trash2
                                size={14}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() =>
              setShowModal(false)
            }
          />

          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-lg animate-scaleIn max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-surface-dark p-6 pb-4 border-b border-border dark:border-border-dark rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary dark:text-stone-100">
                  {editingId
                    ? 'Editar Produto'
                    : 'Novo Produto'}
                </h2>

                <button
                  onClick={() =>
                    setShowModal(false)
                  }
                  className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit(
                (d) =>
                  saveMutation.mutate(
                    d
                  )
              )}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Nome do produto *
                  </label>

                  <input
                    type="text"
                    className="input"
                    placeholder="Ex: Copo personalizado"
                    {...register(
                      'name'
                    )}
                  />

                  {errors.name && (
                    <p className="mt-1 text-xs text-error">
                      {
                        errors.name
                          .message
                      }
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setShowModal(false)
                  }
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    saveMutation.isPending
                  }
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {saveMutation.isPending ? (
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />
                  ) : null}

                  {saveMutation.isPending
                    ? 'Salvando...'
                    : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
