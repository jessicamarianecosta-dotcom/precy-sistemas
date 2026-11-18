'use client'

import { useMemo, useState } from 'react'
import { Archive, Minus, Plus, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/precyflow/supabase'
import { EmptyState } from '@/components/precyflow/EmptyState'
import type { PrecyFlowMaterial, PrecyFlowProduct } from '@/lib/precyflow/types'

/* Estoque não é uma tabela própria: junta precyflow_products.stock_quantity
   (estoque de produto acabado) e precyflow_materials.quantity (estoque de
   insumo/material), cada um já com seu próprio minimum_quantity — essa
   distinção explícita (abas Produtos/Materiais) atende ao pedido do guia
   sem duplicar dado que já existe nos módulos de Produtos e Materiais. */
export function EstoqueClient({
  initialProducts,
  initialMaterials,
}: {
  initialProducts: PrecyFlowProduct[]
  initialMaterials: PrecyFlowMaterial[]
}) {
  const [tab, setTab] = useState<'produtos' | 'materiais'>('produtos')
  const [products, setProducts] = useState(initialProducts)
  const [materials, setMaterials] = useState(initialMaterials)

  const lowStockCount = useMemo(
    () => products.filter(p => p.stock_quantity <= p.minimum_quantity).length + materials.filter(m => m.quantity <= m.minimum_quantity).length,
    [products, materials]
  )

  async function adjustProduct(product: PrecyFlowProduct, delta: number) {
    const next = Math.max(0, product.stock_quantity + delta)
    setProducts(prev => prev.map(p => (p.id === product.id ? { ...p, stock_quantity: next } : p)))
    const supabase = createClient()
    await supabase.from('precyflow_products').update({ stock_quantity: next }).eq('id', product.id)
  }

  async function adjustMaterial(material: PrecyFlowMaterial, delta: number) {
    const next = Math.max(0, material.quantity + delta)
    setMaterials(prev => prev.map(m => (m.id === material.id ? { ...m, quantity: next } : m)))
    const supabase = createClient()
    await supabase.from('precyflow_materials').update({ quantity: next }).eq('id', material.id)
  }

  const rows = tab === 'produtos'
    ? products.map(p => ({ id: p.id, name: p.name, quantity: p.stock_quantity, minimum: p.minimum_quantity, unit: 'un', onAdjust: (d: number) => adjustProduct(p, d) }))
    : materials.map(m => ({ id: m.id, name: m.name, quantity: m.quantity, minimum: m.minimum_quantity, unit: m.unit, onAdjust: (d: number) => adjustMaterial(m, d) }))

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--pf-text)' }}>Estoque</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pf-text-secondary)' }}>
            {lowStockCount > 0 ? `${lowStockCount} item(ns) precisam de reposição` : 'Tudo certo com o seu estoque'}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('produtos')} className="pf-badge" style={{ backgroundColor: tab === 'produtos' ? 'var(--pf-primary)' : 'var(--pf-bg)', color: tab === 'produtos' ? '#fff' : 'var(--pf-text-secondary)', border: '1px solid var(--pf-border)' }}>
          Produtos
        </button>
        <button onClick={() => setTab('materiais')} className="pf-badge" style={{ backgroundColor: tab === 'materiais' ? 'var(--pf-primary)' : 'var(--pf-bg)', color: tab === 'materiais' ? '#fff' : 'var(--pf-text-secondary)', border: '1px solid var(--pf-border)' }}>
          Materiais
        </button>
      </div>

      <div className="pf-card !p-0 overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Archive} title={tab === 'produtos' ? 'Nenhum produto cadastrado' : 'Nenhum material cadastrado'} description={`Cadastre ${tab} para acompanhar o estoque aqui.`} />
        ) : (
          <div className="table-responsive">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--pf-border)' }}>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Item</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Mínimo</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Quantidade</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const low = row.quantity <= row.minimum
                  return (
                    <tr key={row.id} style={{ borderTop: '1px solid var(--pf-border)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--pf-text)' }}>{row.name}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>{row.minimum} {row.unit}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5" style={{ color: low ? 'var(--pf-warning)' : 'var(--pf-text)' }}>
                          {low && <AlertTriangle size={14} />}
                          <span className="font-medium">{row.quantity} {row.unit}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => row.onAdjust(-1)} aria-label="Diminuir" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ border: '1px solid var(--pf-border)', color: 'var(--pf-text-secondary)' }}>
                            <Minus size={14} />
                          </button>
                          <button onClick={() => row.onAdjust(1)} aria-label="Aumentar" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ border: '1px solid var(--pf-border)', color: 'var(--pf-text-secondary)' }}>
                            <Plus size={14} />
                          </button>
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
    </div>
  )
}
