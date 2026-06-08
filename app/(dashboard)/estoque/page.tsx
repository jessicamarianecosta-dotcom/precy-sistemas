'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Boxes,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  X,
  Loader2,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { clsx } from 'clsx'

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  category: z.string().min(1, 'Categoria obrigatória'),
  unit: z.string().default('un'),
  quantity: z.coerce.number().min(0),
  minimum_quantity: z.coerce.number().min(0),
  cost_per_unit: z.coerce.number().min(0),
  supplier: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const STATUS_CONFIG = {
  healthy: {
    label: 'Saudável',
    icon: CheckCircle,
    badge: 'badge-success',
  },
  attention: {
    label: 'Atenção',
    icon: AlertTriangle,
    badge: 'badge-warning',
  },
  critical: {
    label: 'Crítico',
    icon: AlertTriangle,
    badge: 'badge-error',
  },
}

export default function EstoquePage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] =
    useState<string>('all')

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const response: any = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .single()

      const company = response?.data

      if (company?.id) {
        setCompanyId(company.id)
      }
    }

    load()
  }, [])

  const { data: items, isLoading } = useQuery({
    queryKey: ['inventory', companyId],
    enabled: !!companyId,

    queryFn: async () => {
      const response: any = await supabase
        .from('inventory')
        .select('*')
        .eq('company_id', companyId!)
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
  } = useForm<FormData>({
    resolver: zodResolver(schema),

    defaultValues: {
      unit: 'un',
      quantity: 0,
      minimum_quantity: 5,
      cost_per_unit: 0,
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (editingId) {
        await (supabase.from('inventory') as any)
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)
      } else {
        await (supabase.from('inventory') as any)
          .insert([
            {
              ...data,
              company_id: companyId!,
            },
          ])
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['inventory', companyId],
      })

      queryClient.invalidateQueries({
        queryKey: ['dashboard', companyId],
      })

      setShowModal(false)
      reset()
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await (supabase.from('inventory') as any)
        .delete()
        .eq('id', id)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['inventory', companyId],
      })
    },
  })

  function openEdit(item: any) {
    setEditingId(item.id)

    Object.entries(item).forEach(([k, v]) => {
      setValue(k as keyof FormData, v as never)
    })

    setShowModal(true)
  }

  const filtered =
    items?.filter((i: any) => {
      const matchSearch = i.name
        .toLowerCase()
        .includes(search.toLowerCase())

      const matchStatus =
        filterStatus === 'all' ||
        i.status === filterStatus

      return matchSearch && matchStatus
    }) ?? []

  const criticalCount =
    items?.filter(
      (i: any) => i.status === 'critical'
    ).length ?? 0

  const attentionCount =
    items?.filter(
      (i: any) => i.status === 'attention'
    ).length ?? 0

  return (
    <div className="page-enter">
      <Header
        title="Estoque"
        subtitle="Controle de materiais e insumos"
      />

      <div className="p-6 space-y-4">
        {(criticalCount > 0 ||
          attentionCount > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {criticalCount > 0 && (
              <div className="card border-error/30 bg-error-light dark:bg-error/10 p-4 flex items-center gap-3">
                <AlertTriangle
                  size={18}
                  className="text-error flex-shrink-0"
                />

                <div>
                  <p className="text-sm font-semibold text-error-dark">
                    {criticalCount} item
                    {criticalCount > 1
                      ? 's'
                      : ''}{' '}
                    crítico
                    {criticalCount > 1
                      ? 's'
                      : ''}
                  </p>

                  <p className="text-xs text-error/70">
                    Estoque zerado
                  </p>
                </div>
              </div>
            )}

            {attentionCount > 0 && (
              <div className="card border-warning/30 bg-warning-light dark:bg-warning/10 p-4 flex items-center gap-3">
                <AlertTriangle
                  size={18}
                  className="text-warning flex-shrink-0"
                />

                <div>
                  <p className="text-sm font-semibold text-warning-dark">
                    {attentionCount} item
                    {attentionCount > 1
                      ? 's'
                      : ''}{' '}
                    em atenção
                  </p>

                  <p className="text-xs text-warning/70">
                    Abaixo do mínimo
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />

              <input
                type="text"
                placeholder="Buscar..."
                className="input pl-9 w-52"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />
            </div>

            <select
              className="input w-36"
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value)
              }
            >
              <option value="all">
                Todos
              </option>

              <option value="healthy">
                Saudável
              </option>

              <option value="attention">
                Atenção
              </option>

              <option value="critical">
                Crítico
              </option>
            </select>
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
            Novo Item
          </button>
        </div>

        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-6">
              <SkeletonTable rows={5} />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Estoque vazio"
              description="Cadastre seus materiais e controle o estoque."
              action={{
                label: '+ Novo Item',
                onClick: () =>
                  setShowModal(true),
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                  {filtered.map((item: any) => (
                    <tr key={item.id}>
                      <td className="p-4">
                        {item.name}
                      </td>

                      <td className="p-4">
                        <button
                          onClick={() =>
                            openEdit(item)
                          }
                        >
                          <Edit2 size={14} />
                        </button>

                        <button
                          onClick={() =>
                            deleteMutation.mutate(
                              item.id
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() =>
              setShowModal(false)
            }
          />

          <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-lg">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId
                  ? 'Editar Item'
                  : 'Novo Item'}
              </h2>

              <button
                onClick={() =>
                  setShowModal(false)
                }
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit((d) =>
                saveMutation.mutate(d)
              )}
              className="p-6 space-y-4"
            >
              <input
                className="input"
                placeholder="Nome"
                {...register('name')}
              />

              <input
                className="input"
                placeholder="Categoria"
                {...register('category')}
              />

              <div className="flex gap-3">
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
    </div>
  )
}
