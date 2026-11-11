'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, AlertTriangle, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePrecyflowCompany } from '@/hooks/usePrecyflowCompany'
import { PrecyflowHeader } from '@/components/precyflow/Header'
import { PrecyflowModal } from '@/components/precyflow/Modal'
import { PrecyflowEmptyState } from '@/components/precyflow/EmptyState'

interface StockProduct {
  id: string
  name: string
  category: string
  stock_quantity: number
  minimum_stock: number
}

function useStock(companyId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['precyflow-estoque', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from('products')
        .select('id, name, category, stock_quantity, minimum_stock')
        .eq('company_id', companyId as string)
        .eq('is_active', true)
        .order('name') as any
      if (error) throw error
      return (data ?? []) as StockProduct[]
    },
  })
}

export default function PrecyflowEstoquePage() {
  const { companyId, companyName } = usePrecyflowCompany()
  const { data: products, isLoading } = useStock(companyId)
  const queryClient = useQueryClient()
  const supabase = createClient()

  const [editing, setEditing] = useState<StockProduct | null>(null)
  const [form, setForm] = useState({ stock_quantity: '', minimum_stock: '' })
  const [saving, setSaving] = useState(false)

  const lowStock = (products ?? []).filter(p => p.stock_quantity <= p.minimum_stock)

  function openEdit(p: StockProduct) {
    setEditing(p)
    setForm({ stock_quantity: String(p.stock_quantity), minimum_stock: String(p.minimum_stock) })
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const stock_quantity = Number(form.stock_quantity.replace(',', '.')) || 0
      const minimum_stock = Number(form.minimum_stock.replace(',', '.')) || 0
      await (supabase.from('products') as any).update({ stock_quantity, minimum_stock }).eq('id', editing.id)
      await queryClient.invalidateQueries({ queryKey: ['precyflow-estoque', companyId] })
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PrecyflowHeader title="Estoque" subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-4">
        <p className="text-sm" style={{ color: 'var(--pf-text-secondary)' }}>
          Estoque dos produtos finais do catálogo. Para os insumos usados na produção, veja o módulo Materiais.
        </p>

        {lowStock.length > 0 && (
          <div className="pf-card p-3 flex items-center gap-2.5 text-sm" style={{ borderColor: 'var(--pf-warning)' }}>
            <AlertTriangle size={16} className="text-warning flex-shrink-0" />
            <span>{lowStock.length} produto(s) no estoque mínimo ou abaixo — considere repor.</span>
          </div>
        )}

        {isLoading ? (
          <div className="pf-card h-64 animate-pulse" />
        ) : !products?.length ? (
          <div className="pf-card">
            <PrecyflowEmptyState icon={Boxes} title="Nenhum produto ativo" subtitle="Cadastre produtos no módulo Produtos para controlar o estoque." />
          </div>
        ) : (
          <div className="pf-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: 'var(--pf-border)', color: 'var(--pf-text-secondary)' }}>
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium">Disponível</th>
                  <th className="px-4 py-3 font-medium">Mínimo</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const low = p.stock_quantity <= p.minimum_stock
                  return (
                    <tr key={p.id} className="border-b last:border-0" style={{ borderColor: 'var(--pf-border)' }}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>{p.category}</p>
                      </td>
                      <td className="px-4 py-3">{p.stock_quantity}</td>
                      <td className="px-4 py-3">{p.minimum_stock}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${low ? 'bg-warning-light text-warning-dark' : 'bg-success-light text-success-dark'}`}>
                          {low ? 'Repor' : 'Ok'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:pf-bg-primary-soft"><Pencil size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <PrecyflowModal title={`Estoque — ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Quantidade disponível</label>
                <input className="input" inputMode="decimal" value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Estoque mínimo</label>
                <input className="input" inputMode="decimal" value={form.minimum_stock} onChange={e => setForm(f => ({ ...f, minimum_stock: e.target.value }))} />
              </div>
            </div>
            <button onClick={handleSave} disabled={saving} className="pf-btn-primary w-full py-2.5 mt-2">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </PrecyflowModal>
      )}
    </div>
  )
}
