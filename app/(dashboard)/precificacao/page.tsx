'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import {
  Calculator,
  TrendingUp,
} from 'lucide-react'

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(v)
}

export default function PrecificacaoPage() {
  const supabase = createClient()

  const [companyId, setCompanyId] =
    useState<string | null>(null)

  const [form, setForm] = useState({
    productName: '',
    materialCost: 0,
    productionHours: 1,
    markup: 100,
  })

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const response: any = await supabase
        .from('companies')
        .select(
          'id, fixed_costs, work_hours_per_month'
        )
        .eq('user_id', user.id)
        .single()

      const company = response?.data

      if (company?.id) {
        setCompanyId(company.id)
      }
    }

    load()
  }, [])

  const { data: company } = useQuery({
    queryKey: [
      'company-pricing',
      companyId,
    ],

    enabled: !!companyId,

    queryFn: async () => {
      const response: any =
        await supabase
          .from('companies')
          .select(
            'fixed_costs, work_hours_per_month'
          )
          .eq('id', companyId!)
          .single()

      return response?.data
    },
  })

  const fixedCosts =
    (company as any)?.fixed_costs ?? 0

  const workHours =
    (company as any)
      ?.work_hours_per_month ?? 160

  const hourlyRate =
    workHours > 0
      ? fixedCosts / workHours
      : 0

  const laborCost =
    hourlyRate *
    form.productionHours

  const totalCost =
    form.materialCost + laborCost

  const idealPrice =
    totalCost *
    (1 + form.markup / 100)

  const profit =
    idealPrice - totalCost

  const margin =
    idealPrice > 0
      ? (profit / idealPrice) * 100
      : 0

  const scenarios = [
    {
      label: 'Conservador',
      markup: 50,
      price: totalCost * 1.5,
    },

    {
      label: 'Ideal',
      markup: form.markup,
      price: idealPrice,
    },

    {
      label: 'Premium',
      markup: form.markup * 1.5,
      price:
        totalCost *
        (1 +
          (form.markup * 1.5) / 100),
    },
  ]

  return (
    <div className="page-enter">
      <Header
        title="Precificação"
        subtitle="Calcule o preço ideal dos seus produtos"
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-primary-50 dark:bg-primary/10">
                <Calculator
                  size={20}
                  className="text-primary"
                />
              </div>

              <div>
                <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                  Calculadora
                </h2>

                <p className="text-xs text-text-muted dark:text-stone-400">
                  Preencha os dados do produto
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                Nome do Produto
              </label>

              <input
                className="input"
                placeholder="Ex: Copo personalizado"
                value={form.productName}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    productName:
                      e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                Custo de Materiais (R$)
              </label>

              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="0,00"
                value={
                  form.materialCost || ''
                }
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    materialCost:
                      parseFloat(
                        e.target.value
                      ) || 0,
                  }))
                }
              />

              <p className="mt-1 text-xs text-text-muted dark:text-stone-500">
                Soma de todos os materiais
                usados
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                Tempo de Produção (horas)
              </label>

              <input
                type="number"
                step="0.1"
                className="input"
                placeholder="1"
                value={
                  form.productionHours ||
                  ''
                }
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    productionHours:
                      parseFloat(
                        e.target.value
                      ) || 0,
                  }))
                }
              />

              <p className="mt-1 text-xs text-text-muted dark:text-stone-500">
                Custo/hora:{' '}
                {formatCurrency(
                  hourlyRate
                )}{' '}
                (baseado nos seus custos
                fixos)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                Margem de Lucro:{' '}
                <span className="text-primary font-bold">
                  {form.markup}%
                </span>
              </label>

              <input
                type="range"
                min={10}
                max={500}
                step={5}
                className="w-full accent-primary"
                value={form.markup}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    markup: parseInt(
                      e.target.value
                    ),
                  }))
                }
              />

              <div className="flex justify-between text-xs text-text-muted mt-1">
                <span>10%</span>
                <span>100%</span>
                <span>500%</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary/10 border border-primary/20">
              <p className="text-xs text-primary font-medium">
                📊 Seus custos fixos
                mensais
              </p>

              <p className="text-xs text-text-secondary dark:text-stone-400 mt-1">
                Total:{' '}
                {formatCurrency(
                  fixedCosts
                )}{' '}
                ÷ {workHours}h ={' '}
                {formatCurrency(
                  hourlyRate
                )}
                /hora
              </p>

              {!fixedCosts && (
                <p className="text-xs text-warning mt-1">
                  ⚠️ Configure seus
                  custos fixos em
                  Configurações para
                  precificação precisa
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card bg-gradient-primary text-white">
              <p className="text-sm font-medium opacity-80 mb-1">
                Preço Ideal
              </p>

              <p className="text-4xl font-bold mb-1">
                {formatCurrency(
                  idealPrice
                )}
              </p>

              <p className="text-sm opacity-70">
                Margem:{' '}
                {margin.toFixed(1)}% •
                Lucro:{' '}
                {formatCurrency(
                  profit
                )}
              </p>
            </div>

            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                Composição do Preço
              </h3>

              {[
                {
                  label:
                    'Custo de Materiais',

                  value:
                    form.materialCost,

                  color:
                    'bg-info-light text-info-dark',
                },

                {
                  label: `Mão de Obra (${form.productionHours}h × ${formatCurrency(hourlyRate)})`,

                  value: laborCost,

                  color:
                    'bg-warning-light text-warning-dark',
                },

                {
                  label: 'Custo Total',

                  value: totalCost,

                  color:
                    'bg-error-light text-error-dark',
                },

                {
                  label: `Lucro (${form.markup}%)`,

                  value: profit,

                  color:
                    'bg-success-light text-success-dark',
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-text-secondary dark:text-stone-400">
                    {row.label}
                  </span>

                  <span
                    className={`badge font-bold ${row.color}`}
                  >
                    {formatCurrency(
                      row.value
                    )}
                  </span>
                </div>
              ))}

              <div className="pt-2 border-t border-border dark:border-border-dark flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary dark:text-stone-100">
                  Preço Final
                </span>

                <span className="text-lg font-bold text-primary">
                  {formatCurrency(
                    idealPrice
                  )}
                </span>
              </div>
            </div>

            <div className="card space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp
                  size={16}
                  className="text-primary"
                />

                <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                  Cenários de Preço
                </h3>
              </div>

              {scenarios.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between p-3 rounded-xl border border-border dark:border-border-dark hover:border-primary/40 transition-colors cursor-pointer"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      markup:
                        s.markup,
                    }))
                  }
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary dark:text-stone-100">
                      {s.label}
                    </p>

                    <p className="text-xs text-text-muted">
                      {s.markup.toFixed(
                        0
                      )}
                      % de margem
                    </p>
                  </div>

                  <span className="text-base font-bold text-primary">
                    {formatCurrency(
                      s.price
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
