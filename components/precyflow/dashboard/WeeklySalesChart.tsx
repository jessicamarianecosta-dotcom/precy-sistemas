'use client'

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

export function WeeklySalesChart({ data }: { data: { label: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--pf-text-secondary)' }} />
        <Tooltip
          formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          contentStyle={{ borderRadius: 12, border: '1px solid var(--pf-border)', fontSize: 13 }}
        />
        <Bar dataKey="total" fill="var(--pf-primary)" radius={[6, 6, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}
