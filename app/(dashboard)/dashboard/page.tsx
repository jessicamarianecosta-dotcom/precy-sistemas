'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  ArrowRight,
  Package,
  DollarSign,
  BarChart3,
  Clock,
} from 'lucide-react'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

import { createClient } from '@/lib/supabase/client'
import { useDashboard } from '@/hooks/useDashboard'
import { Header } from '@/components/layout/Header'
import { SkeletonDashboard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { clsx } from 'clsx'
import Link from 'next/link'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const STATUS_COLORS = {
  pending: '#C4893A',
  production: '#3A7EC4',
  ready: '#5C8B4F',
  delivered: '#8B6C4F',
  cancelled: '#C4503A',
}

const STATUS_LABELS = {
  pending: 'Pendente',
  production: 'Produção',
  ready: 'Pronto',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

export default function DashboardPage() {
  const supabase = createClient()

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [userName, setUserName] = useState('')

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const profileResponse: any = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()

      const profile = profileResponse?.data

      if (profile) {
        setUserName(
          ((profile as any)?.name ?? 'você')
            .split(' ')[0]
        )
      }

      const companyResponse: any = await supabase
        .from('companies')
        .select('id, name')
        .eq('user_id', user.id)
        .single()

      const company = companyResponse?.data

      if (company) {
        setCompanyId((company as any)?.id ?? null)
        setCompanyName((company as any)?.name ?? '')
      }
    }

    load()
  }, [])

  const { data, isLoading, isError } = useDashboard(companyId)

  const hour = new Date().getHours()

  const greeting =
    hour < 12
      ? 'Bom dia'
      : hour < 18
      ? 'Boa tarde'
      : 'Boa noite'

  const metricCards = [
    {
      label: 'Faturamento',
      value: formatCurrency(data?.revenue ?? 0),
      icon: TrendingUp,
      color: 'text-success',
      bg: 'bg-success-light dark:bg-success/10',
      description: 'Este mês',
    },
    {
      label: 'Lucro Líquido',
      value: formatCurrency(data?.profit ?? 0),
      icon: DollarSign,
      color:
        data?.profit && data.profit >= 0
          ? 'text-success'
          : 'text-error',
      bg:
        data?.profit && data.profit >= 0
          ? 'bg-success-light dark:bg-success/10'
          : 'bg-error-light dark:bg-error/10',
      description: 'Receita – despesas',
    },
    {
      label: 'Pedidos Ativos',
      value: String(data?.activeOrdersCount ?? 0),
      icon: ShoppingCart,
      color: 'text-info',
      bg: 'bg-info-light dark:bg-info/10',
      description: 'Em andamento',
    },
    {
      label: 'Estoque Crítico',
      value: String(data?.criticalStockCount ?? 0),
      icon: AlertTriangle,
      color: data?.criticalStockCount
        ? 'text-warning'
        : 'text-success',
      bg: data?.criticalStockCount
        ? 'bg-warning-light dark:bg-warning/10'
        : 'bg-success-light dark:bg-success/10',
      description: 'Itens em alerta',
    },
  ]

  const pieData = Object.entries(data?.ordersByStatus ?? {})
    .filter(([, v]) => Number(v) > 0)
    .map(([key, value]) => ({
      name:
        STATUS_LABELS[
          key as keyof typeof STATUS_LABELS
        ],
      value,
      color:
        STATUS_COLORS[
          key as keyof typeof STATUS_COLORS
        ],
    }))

  return (
    <div className="page-enter">
      <Header
        title={`${greeting}, ${userName}! 👋`}
        subtitle={companyName || 'Carregando...'}
      />

      <div className="p-6 space-y-6">
        {isLoading ? (
          <SkeletonDashboard />
        ) : isError ? (
          <div className="card text-center py-12">
            <p className="text-error font-medium">
              Erro ao carregar dados. Tente novamente.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {metricCards.map((card) => {
                const Icon = card.icon

                return (
                  <div
                    key={card.label}
                    className="card"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider">
                          {card.label}
                        </p>
                      </div>

                      <div
                        className={clsx(
                          'p-2 rounded-xl',
                          card.bg
                        )}
                      >
                        <Icon
                          size={18}
                          className={card.color}
                        />
                      </div>
                    </div>

                    <p className="text-2xl font-bold mb-1">
                      {card.value}
                    </p>

                    <p className="text-xs opacity-70">
                      {card.description}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold mb-4">
                Dashboard carregado com sucesso 🎉
              </h2>

              <p className="text-sm opacity-70">
                Empresa: {companyName || 'Sem empresa'}
              </p>

              <p className="text-sm opacity-70 mt-2">
                Usuário: {userName || 'Usuário'}
              </p>

              <p className="text-sm opacity-70 mt-2">
                Pedidos ativos:{' '}
                {data?.activeOrdersCount ?? 0}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
